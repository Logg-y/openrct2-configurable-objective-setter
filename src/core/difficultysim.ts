import { getConfigOption } from "./sharedstorage";
import { ScenarioSettings, getGuestMinimumInitialCash } from "./scenariosettings";
import { MapAnalysis } from "./maptiles";
import { log } from "../util/logging";

type AdvertisingCampaign = "freeEntry" | "freeRide" | "halfPriceEntry" | "freeFoodDrink" | "park" | "ride";

// Spending strategies.
// There is essentially a choice of two things we can be trying to do in any given month:

// 1) Make money, because financial pressure means we have to.
// 2) Make the guest count go up, because the objective demands it.

// Pay per ride, cash machine available: guest count going up is the only direction that makes sense, as guests = profit because more guests introduces more cash via ATM
// Pay per ride, no cash machine: if we charge max for rides we make money but guests leave as they go broke, if we undercharge then guests will stay longer

// Pay per entry: play for money means deliberately letting guests get unhappy to have them leave and new ones come in (eg closing all rides)
//                play for guest count means trying to retain guests so the count goes up, which leaves us out of pocket
// In both cases, the cash machine's existence doesn't really make much difference.

// See also: comment at the top of difficultysimmanager.ts

type SpendingStrategy = "guestcount" | "profit";

//const monthDays = [31, 30, 31, 30, 31, 31, 30, 31];
const monthWeeks = 4;

const months = ["March", "April", "May", "June", "July", "August", "September", "October"];

// The sim often likes to try to pay back all its loan instantly
// which leaves it with no cash to build anything with
const maxProportionOfAvailableCashIntoLoanRepayment = 0.6;

// I don't want to bang my head on the entity limit.
const maxGuestsConsidered = 50000;

interface SoftGuestCapCost
{
    rideCost: number;
    landCost: number;
    landTiles: number;
    totalCost: number;
    quantity: number;
}

interface RideBuildingOption
{
    type: "building",
    softGuestCapIncrease: number,
    cost: number,
    actionIncome: number,
    landTiles: number,
    rideCost: number,
    landCost: number
}

interface AdvertisingOption
{
    type: "advertising",
    extraGuests: number;
    cost: number;
    actionIncome: number,
    campaign: AdvertisingCampaign,
}

interface RepayLoanOption
{
    type: "repayloan",
    extraGuests: 0,
    cost: number,
    actionIncome: number,
}

interface IncreaseLoanOption
{
    type: "increaseloan",
    extraGuests: 0,
    cost: number,
    actionIncome: number,
}

// extraGuests - the actual number of guests by taking the option
// cost - the actual cost for the option
// actionIncome - used only to evaluate cost/benefit of the option
type SpendingOption = RideBuildingOption | AdvertisingOption | RepayLoanOption | IncreaseLoanOption;

// Sort an array of SpendingOptions based on what gives the best (guest or long term profit) to cost ratio.
function sortSpendingOptions(options: SpendingOption[], strategy: SpendingStrategy): SpendingOption[]
{
    return options.sort((first, second) => {
        let one = first.actionIncome - first.cost;
        let two = second.actionIncome - second.cost;
        if (strategy === "guestcount")
        {
            if (first.type === "building")
            {
                one = first.softGuestCapIncrease/(one !== 0 ? one : 0.0001);
            }
            else
            {
                one = first.extraGuests/(one !== 0 ? one : 0.0001);
            }
            if (second.type === "building")
            {
                two = second.softGuestCapIncrease/(two !== 0 ? two : 0.0001);
            }
            else
            {
                two = second.extraGuests/(two !== 0 ? two : 0.0001);
            }
        }
        else if (strategy === "profit")
        {
            one = first.cost/(one !== 0 ? one : 0.0001);
            two = second.cost/(two !== 0 ? two : 0.0001);
        }
        if (one > two) { return 1; }
        if (two > one) { return -1; }
        return 0;
    });
}

interface NaturalGuestGeneration
{
    // Expected naturally generated guests if we quickly built rides so we were ahead of SGC for the whole month
    maximum: number,
    // Expected naturally generated guests if SGC stays where it is
    current: number,
}

interface GuestCountsByCash
{
    [cash: number]: number;
}

export class DifficultySim
{
    // Basic parameters/inputs
    monthsLeft=-1;
    monthsCompleted=0;
    unrepaidLoan=0;
    // Both an input and modified
    softGuestCap=0;
    cashAvailable=0;
    guestsInPark=0;
    availableLandForBuilding=-1;
    buyableLand=0;
    // Purely to hold results from simulation
    entryTicketsThisMonth=0;
    passiveExpenditure=0;
    lowestCashAvailable = -1;
    guestCountsByCash: GuestCountsByCash = [];
    monthExceededDensityLimit: undefined | number = undefined;
    totalLandBought = 0;
    totalLandUsage = 0;

    // A list of strings that report what we did this month
    activityLog: string[] = [];


    addGuests(amount: number, carriedCash: number | undefined = undefined)
    {
        if (carriedCash === undefined)
        {
            carriedCash = ScenarioSettings.payPerRide ? ScenarioSettings.guestInitialCash : getGuestMinimumInitialCash();
        }
        amount = Math.round(amount);
        this.guestsInPark += amount;
        let addition = Math.max(0, (this.guestCountsByCash[carriedCash] || 0) + amount);
        this.guestCountsByCash[carriedCash] = addition;
        
        
        if (!ScenarioSettings.payPerRide)
        {
            this.entryTicketsThisMonth += carriedCash * amount;
        }
    }

    // Returns the amount of guests we expect from natural guest generation in a few different cases
    getNaturalGuestGeneration(): NaturalGuestGeneration
    {
        let parkRating = 850;
        if (this.guestsInPark < 200)
        {
            parkRating = 700;
        }
        let maxProbability = 50 + parkRating - 200;
        let currentProbability = maxProbability;
        if (this.guestsInPark > this.softGuestCap)
        {
            currentProbability /= 4;
            if (ScenarioSettings.flags.indexOf("difficultGuestGeneration") > -1)
            {
                if (this.guestsInPark > this.softGuestCap + 150)
                {
                    currentProbability = 0;
                }
                currentProbability /= 4;
            }
        }
        if (this.guestsInPark > 7000)
        {
            maxProbability /= 4;
            currentProbability /= 4;
        }
        // Ignored: overcharging for entry
        // Ignored: awards

        // Enforce entity limit (it's something like ~65535 but I do not want to get into simulating how many slots we have free)
        if (this.guestsInPark > maxGuestsConsidered)
        {
            maxProbability = 0;
            currentProbability = 0;
        }

        let guestDifficulty = getConfigOption("GuestDifficulty")/100;
        let returnVal: NaturalGuestGeneration = {
            maximum: Math.floor(16384 * (maxProbability/65535) * guestDifficulty),
            current: Math.floor(16384 * (currentProbability/65535) * guestDifficulty),
        }
        // If current guest generation would have us cross the soft guest cap, we need to lower it
        if (this.guestsInPark <= this.softGuestCap && this.guestsInPark + returnVal.current > this.softGuestCap)
        {
            let currentOvershoot = (this.guestsInPark + returnVal.current) - this.softGuestCap;
            if (currentOvershoot > 0)
            {
                let proportionOfMonthOver = (currentOvershoot/returnVal.current);

                let oldGuestsInPark = this.guestsInPark;
                this.guestsInPark = this.softGuestCap+1;
                let projected = this.getNaturalGuestGeneration();
                this.guestsInPark = oldGuestsInPark;
                let newValue = (this.softGuestCap - this.guestsInPark) + Math.round(projected.current * proportionOfMonthOver);
                //this.activityLog.push(`Guest generation: current ${returnVal.current} overshoots guest cap by ${currentOvershoot}, proportion of month over = ${proportionOfMonthOver}, projected = ${projected.current} -> ${newValue}`);

                returnVal.current = newValue;
                
            }
        }
       
        return returnVal;
    }

    getCostOfAdditionalEasySoftGuestCap(desiredAdditional: number): SoftGuestCapCost
    {
        let rideCost = (desiredAdditional*getConfigOption("SimCostPer100SGC"))/100;
        let landTileMultiplier = ScenarioSettings.flags.indexOf("forbidHighConstruction") > -1 ? getConfigOption("SimForbidHighConstructionLandUsage") : 1;
        let landTiles = landTileMultiplier * (desiredAdditional/(getConfigOption("MaxDensity")));
        let landCost = Math.max(0, landTiles - this.availableLandForBuilding) * ScenarioSettings.landPrice;
        let totalCost = rideCost + landCost;
        return {
            rideCost: rideCost,
            landTiles: landTiles,
            landCost: landCost,
            totalCost: totalCost,
            quantity: desiredAdditional,
        }
    }

    getCostOfAdditionalHarderSoftGuestCap(desiredAdditional: number): SoftGuestCapCost
    {
        let rideCost = (desiredAdditional*getConfigOption("SimCostPer100SGC"))/100;
        let landTileMultiplier = ScenarioSettings.flags.indexOf("forbidHighConstruction") > -1 ? getConfigOption("SimForbidHighConstructionLandUsage") : 1;
        let landTiles = landTileMultiplier * (desiredAdditional/(getConfigOption("MaxDensityHardGuestGen")));
        let landCost = Math.max(0, landTiles - this.availableLandForBuilding) * ScenarioSettings.landPrice;
        let totalCost = rideCost + landCost;
        return {
            rideCost: rideCost,
            landTiles: landTiles,
            landCost: landCost,
            totalCost: totalCost,
            quantity: desiredAdditional,
        }
    }

    getCostOfAdditionalSoftGuestCap(desiredAdditional: number): SoftGuestCapCost
    {
        if (ScenarioSettings.flags.indexOf("difficultGuestGeneration") > -1)
        {
            let targetAmount = this.softGuestCap + desiredAdditional;
            if (this.softGuestCap < 1000 && targetAmount > 1000)
            {
                let easy = this.getCostOfAdditionalEasySoftGuestCap(1000 - this.softGuestCap);
                let hard = this.getCostOfAdditionalHarderSoftGuestCap(targetAmount - 1000);
                return {
                    rideCost: easy.rideCost + hard.rideCost,
                    landTiles: easy.landTiles + hard.landTiles,
                    landCost: easy.landCost + hard.landCost,
                    totalCost: easy.totalCost + hard.totalCost,
                    quantity: easy.quantity + hard.quantity,
                }
            }
            if (targetAmount > 1000)
            {
                return this.getCostOfAdditionalHarderSoftGuestCap(desiredAdditional);
            }
        }
        return this.getCostOfAdditionalEasySoftGuestCap(desiredAdditional);
    }

    getAmountOfSoftGuestCapThatCanBeAfforded(budget: number): SoftGuestCapCost
    {
        let costForOne = this.getCostOfAdditionalSoftGuestCap(1).totalCost;
        let expectedAmount = Math.floor(budget/costForOne);
        // This is potentially a performance issue when crossing the 1000 threshold in difficult guest gen parks
        // or when crossing into needing to buy land
        // Larger steps may be a good idea
        let step = 128;
        let prevCost = this.getCostOfAdditionalSoftGuestCap(expectedAmount); 
        if (prevCost.totalCost > budget)
        {
            while (true)
            {
                while (prevCost.totalCost > budget)
                {
                    expectedAmount -= step;
                    prevCost = this.getCostOfAdditionalSoftGuestCap(expectedAmount);
                }
                if (step == 1)
                {
                    break;
                }
                // went too far
                expectedAmount += step;
                step /= 2;
            }
            return prevCost;
        }
        while (true)
        {
            while (prevCost.totalCost < budget)
            {
                expectedAmount += step;
                prevCost = this.getCostOfAdditionalSoftGuestCap(expectedAmount);
            }
            // gone too far
            expectedAmount -= step;
            step /= 2;
            if (step == 1)
            {
                break;
            }
        }
        // This loop will push it over budget
        expectedAmount--;
        return this.getCostOfAdditionalSoftGuestCap(expectedAmount);
    }

    getCashPerNewGuest()
    {
        if (ScenarioSettings.payPerRide)
        {
            return ScenarioSettings.guestInitialCash;
        }
        let maxCash = getGuestMinimumInitialCash();
        return Math.min(maxCash, this.softGuestCap * (getConfigOption("SimParkEntryPer100SGC")) / 100);
        
    }

    buildAdvertisingSpendingOptions(strategy: SpendingStrategy): AdvertisingOption[]
    {
        let cashPerGuest = this.getCashPerNewGuest();
        let guestDifficulty = (getConfigOption("GuestDifficulty"))/100;
        let out: AdvertisingOption[] = [];
        out.push({
            type: "advertising",
            campaign: "park",
            cost: 3000*monthWeeks,
            actionIncome: (62.5 * cashPerGuest * guestDifficulty),
            extraGuests: 15.63*monthWeeks*guestDifficulty,
        });
        out.push({
            type: "advertising",
            campaign: "ride",
            cost: 2000*monthWeeks,
            actionIncome: (50 * cashPerGuest*guestDifficulty),
            extraGuests: 12.5*monthWeeks*guestDifficulty,
        });
        out.push({
            type: "advertising",
            campaign: "freeFoodDrink",
            // I'm going to completely ignore the cost of the free food/drink item
            // because it's pretty much negligible and other assumptions in this simulation will inevitably be more inaccurate
            actionIncome: (50*cashPerGuest*guestDifficulty),
            cost: 500*monthWeeks,
            extraGuests: 12.5*monthWeeks*guestDifficulty,
        });
        if (ScenarioSettings.payPerRide)
        {
            out.push({
                type: "advertising",
                campaign: "freeRide",
                // Sure, they get one free ride, but after that we get to help ourselves to the rest of those pockets
                actionIncome: (75* cashPerGuest*guestDifficulty),
                cost: 500*monthWeeks,
                extraGuests: 18.75*monthWeeks*guestDifficulty,
            });
        }
        else
        {
            if (strategy === "guestcount")
            {
                let umbrellaIncome = Math.min(cashPerGuest, 200) * (1.0 - getConfigOption("GuestUmbrellaChance"));
                out.push({
                    type: "advertising",
                    campaign: "freeEntry",
                    // This is the campaign that actively costs you money, because it puts guests in your park that pay no entry fee
                    // Umbrellas can get a bit of that back though
                    actionIncome: (-100 * cashPerGuest * guestDifficulty * 0.5) + 
                        (umbrellaIncome * guestDifficulty),
                    cost: 500*monthWeeks,
                    extraGuests: 25*monthWeeks*guestDifficulty,
                });
            }
            let umbrellaIncome = Math.min(cashPerGuest/2, 200) * (1.0 - getConfigOption("GuestUmbrellaChance"));
            out.push({
                type: "advertising",
                campaign: "halfPriceEntry",
                // This also leaves guests with more in their pockets than normal
                // ... but overcharging for umbrellas also lets you get some of that back
                actionIncome: (-50 * cashPerGuest/2 * guestDifficulty * 0.5) + 
                    (umbrellaIncome * guestDifficulty),
                cost: 500*monthWeeks,
                extraGuests: 12.5*monthWeeks*guestDifficulty,
            });
        }
        return out;
    }

    calculatePassiveExpenditure()
    {
        let sgc = this.softGuestCap * (getConfigOption("SimRideUpkeepPer100SGC")/ 100);
        let staff = this.softGuestCap * (getConfigOption("SimStaffWagesPer100SGC")/ 100);
        let loanWeCanRepay = 10000 * Math.floor(this.cashAvailable/10000);
        let loanWeCantRepay = Math.max(0, this.unrepaidLoan - loanWeCanRepay);
        let bigPart = loanWeCantRepay * 5 * ScenarioSettings.loanInterest;
        let loanInterest = monthWeeks * (bigPart >>> 14);
        this.activityLog.push(context.formatString(`Paid {CURRENCY} ride upkeep.`, sgc));
        this.activityLog.push(context.formatString(`Paid {CURRENCY} staff wages.`, staff));
        this.activityLog.push(context.formatString(`Paid {CURRENCY} loan interest on {CURRENCY} loan we can't repay right now.`, loanInterest, loanWeCantRepay));
        this.passiveExpenditure = sgc + staff + loanInterest;
        this.cashAvailable -= this.passiveExpenditure;
    }

    calculateRideTickets(maxIncomePerGuest: number, updateCashDict: boolean)
    {
        let total = 0;
        let newCountsByCash: GuestCountsByCash = [];
        for (let cashAmount in this.guestCountsByCash)
        {   
            let cashAmountNumber = Number(cashAmount);
            let amountToTake = Math.min(maxIncomePerGuest, cashAmountNumber);
            let newCash = cashAmountNumber-amountToTake;
            newCountsByCash[newCash] = (newCountsByCash[newCash] || 0) + this.guestCountsByCash[cashAmount];
            total += this.guestCountsByCash[cashAmount] * amountToTake;
        }
        if (updateCashDict)
        {
            this.guestCountsByCash = newCountsByCash;
        }
        return total;
    }

    calculateIncome(strategy: SpendingStrategy, cashMachineAvailable: boolean)
    {
        let parkEntryOrRideTickets = 0;
        if (!ScenarioSettings.payPerRide)
        {
            // addGuests keeps track of this, which makes dealing with advertising's money off coupons a lot easier
            // It might be reasonable to have addGuests give some proportion of this upfront given how cash flow is very upfront with entry tickets
            parkEntryOrRideTickets = this.entryTicketsThisMonth;
        }
        else
        {
            let maxProfitPerGuest = getConfigOption("SimGuestRideIncome");
            // Consider undercharging for things
            if (strategy == "guestcount" && ScenarioSettings.payPerRide && !cashMachineAvailable)
            {
                // This is really crude (will be imperfect), but in reality getting every guest to zero cash isn't feasible for an actual player anyway.
                let maxPossible = this.calculateRideTickets(maxProfitPerGuest, false);
                let desiredRideTickets = Math.max(0, maxPossible - this.cashAvailable);
                let amountToCharge = Number((desiredRideTickets/maxPossible).toFixed(1));
                parkEntryOrRideTickets = this.calculateRideTickets(amountToCharge, true);
                this.activityLog.push(context.formatString("Deliberately undercharged ride tickets: {CURRENCY} per guest, aiming for {CURRENCY} total income", amountToCharge, desiredRideTickets));
            }
            else if (!cashMachineAvailable)
            {
                parkEntryOrRideTickets = this.calculateRideTickets(maxProfitPerGuest, true);
            }
            else
            {
                parkEntryOrRideTickets = maxProfitPerGuest * this.guestsInPark;
            }
        }

        // If we are tracking guest cash, we should deduct stalls from it
        let stalls = getConfigOption("SimGuestStallIncome");
        if (ScenarioSettings.payPerRide && !cashMachineAvailable)
        {
            stalls = this.calculateRideTickets(stalls, true);
        }
        // The profit strategy we use for pay for entry is based around not selling food
        // ... so that does deny us stall income
        else if (!ScenarioSettings.payPerRide && strategy == "profit")
        {
            stalls = 0;
        }
        else
        {
            stalls = stalls * this.guestsInPark;
        }
        
        this.activityLog.push(context.formatString("Gained {CURRENCY} from stall income", stalls));
        this.activityLog.push(context.formatString(`Gained {CURRENCY} from ${ScenarioSettings.payPerRide ? "rides" : "entry"}`, parkEntryOrRideTickets));

        this.cashAvailable += stalls + parkEntryOrRideTickets;       
    }

    applyGeneralTurnoverToGuestCountsByCash(turnoverRate: number)
    {
        if (ScenarioSettings.payPerRide)
        {
            let countedForGuests = 0;
            for (let guestCash in this.guestCountsByCash)
            {
                let guestCount = this.guestCountsByCash[guestCash];
                this.guestCountsByCash[guestCash] -= Math.round(guestCount * turnoverRate);
                countedForGuests += guestCount;
                //this.activityLog.push(`${guestCash} has ${guestCount} guests, countedfor now ${countedForGuests}, turnover reduces by ${Math.round(guestCount * turnoverRate)}`);
            }
            // All these round calls introduce rounding errors, mitigate that here
            let requiredModifications = this.guestsInPark - countedForGuests;
            let modificationDirection = requiredModifications >= 0 ? 1 : -1;
            if (requiredModifications > 0)
            {
                this.activityLog.push(`Guest counts per cash rounding error: ${requiredModifications}`);
            }
            requiredModifications = Math.abs(requiredModifications);
            while (requiredModifications > 0)
            {
                let roll = context.getRandom(0, countedForGuests);
                for (let guestCash in this.guestCountsByCash)
                {
                    let guestCount = this.guestCountsByCash[guestCash];
                    if (guestCount < roll)
                    {
                        this.guestCountsByCash[guestCash] += modificationDirection;
                        break;
                    }
                    roll -= guestCount;
                }
                countedForGuests += modificationDirection;
                requiredModifications--;
            }
        }
    }

    checkDensityLimit()
    {
        if (this.monthExceededDensityLimit === undefined)
        {
            let ourDensity = this.softGuestCap / (park.parkSize - ScenarioSettings.numOwnedTilesToBuyable + this.totalLandBought);
            let maxDensity = getConfigOption("MaxDensity");
            if (ScenarioSettings.flags.indexOf("difficultGuestGeneration") > -1 && this.softGuestCap > 1000)
            {
                let easyPortion = maxDensity * 1000;
                let hardPortion = (this.softGuestCap - 1000) * (getConfigOption("MaxDensityHardGuestGen"));
                maxDensity = easyPortion + hardPortion;
            }
            if (ourDensity > maxDensity)
            {
                this.monthExceededDensityLimit = this.monthsCompleted;
            }
        }
    }

    isViable()
    {
        let loanAvailable = ScenarioSettings.maxLoan - this.unrepaidLoan
        let realCashAvailable = this.cashAvailable + loanAvailable;
        if (realCashAvailable < getConfigOption("CashTightness"))
        {
            this.activityLog.push(context.formatString("Nonviable: available cash = {CURRENCY}", this.cashAvailable));
            return false;
        }
        else if (this.cashAvailable < getConfigOption("CashTightness"))
        {
            this.activityLog.push(context.formatString("Dipping into loan to stay viable: cash on hand = {CURRENCY}, loan available = {CURRENCY}, together = {CURRENCY}", this.cashAvailable, loanAvailable, realCashAvailable));
        }
        if (this.lowestCashAvailable < 0 || realCashAvailable < this.lowestCashAvailable)
        {
            this.lowestCashAvailable = realCashAvailable;
        }
        return true;
    }

    // Use the given SpendingStrategy to decide what to do this month
    updateMonth(strategy: SpendingStrategy)
    {
        this.entryTicketsThisMonth = 0;
        this.activityLog.push("======================");
        this.activityLog.push(`Begin month: ${months[this.monthsCompleted % 8]} Year ${1 + (Math.floor(this.monthsCompleted / 8))}, strategy = ${strategy}`);
        log(`Begin month ${this.monthsCompleted}`, "IndividualSim");
        let cashMachineAvailable = ScenarioSettings.cashMachineMonth !== undefined && this.monthsCompleted >= ScenarioSettings.cashMachineMonth;
        
        this.handleSpendingAndGuestGeneration(strategy);
        this.calculatePassiveExpenditure();
        this.calculateIncome(strategy, cashMachineAvailable);
        this.handleGuestTurnover(strategy, cashMachineAvailable);

        this.monthsLeft = this.monthsLeft - 1;
        this.monthsCompleted = this.monthsCompleted + 1;

        this.checkDensityLimit();
    }

    getRideBuildingOption(): RideBuildingOption
    {
        let naturalGuestGeneration = this.getNaturalGuestGeneration();
        let idealSoftGuestCapIncrease = Math.max(0, (this.guestsInPark + naturalGuestGeneration.maximum) - this.softGuestCap);
        //this.activityLog.push(`guests in park ${this.guestsInPark} + max gen ${naturalGuestGeneration.maximum} = ${this.guestsInPark + naturalGuestGeneration.maximum} - sgc ${this.softGuestCap} -> ${idealSoftGuestCapIncrease}`);
        let costOfMaximisingSoftGuestCap = this.getCostOfAdditionalSoftGuestCap(idealSoftGuestCapIncrease);
        if (costOfMaximisingSoftGuestCap.totalCost > this.cashAvailable)
        {
            // Can't afford the whole thing any more, but maybe we can stil get a bit less?
            costOfMaximisingSoftGuestCap = this.getAmountOfSoftGuestCapThatCanBeAfforded(this.cashAvailable);
            // This method will be pessimistic when crossing the 1000 guest barrier in harder guest generation
            let proportionOfMaximum = costOfMaximisingSoftGuestCap.quantity/idealSoftGuestCapIncrease;
            return {
                type: "building",
                softGuestCapIncrease: Math.floor(idealSoftGuestCapIncrease * proportionOfMaximum),
                cost: costOfMaximisingSoftGuestCap.totalCost,
                actionIncome: Math.floor((naturalGuestGeneration.maximum - naturalGuestGeneration.current) * ScenarioSettings.guestInitialCash * proportionOfMaximum),
                landTiles: costOfMaximisingSoftGuestCap.landTiles,
                rideCost: costOfMaximisingSoftGuestCap.rideCost,
                landCost: costOfMaximisingSoftGuestCap.landCost,
            }
        }

        return ({
            type:"building",
            softGuestCapIncrease: idealSoftGuestCapIncrease,
            cost: costOfMaximisingSoftGuestCap.totalCost,
            actionIncome: (naturalGuestGeneration.maximum - naturalGuestGeneration.current) * ScenarioSettings.guestInitialCash,
            landTiles: costOfMaximisingSoftGuestCap.landTiles,
            rideCost: costOfMaximisingSoftGuestCap.rideCost,
            landCost: costOfMaximisingSoftGuestCap.landCost,
        });

    }


    handleSpendingAndGuestGeneration(strategy: SpendingStrategy)
    {
        let canAdvertise = ScenarioSettings.flags.indexOf("forbidMarketingCampaigns") <= -1;

        let fixedSpendingOptions: SpendingOption[] = [];

        if (strategy === "profit")
        {
            let cost = Math.min(this.unrepaidLoan, 10000 * Math.floor(maxProportionOfAvailableCashIntoLoanRepayment * this.cashAvailable / 10000));
            fixedSpendingOptions.push({
                type:"repayloan",
                extraGuests: 0,
                cost: cost,
                actionIncome: this.monthsLeft * monthWeeks * ((cost * 5 * ScenarioSettings.loanInterest) >>> 14),
            })
        }
        let maxLoanWithdraw = ScenarioSettings.maxLoan - this.unrepaidLoan;
        if (maxLoanWithdraw > 0)
        {
            let expectedInterest = this.monthsLeft * monthWeeks * ((maxLoanWithdraw * 5 * ScenarioSettings.loanInterest) >>> 14);
            // we don't really want to increase loan if it would result in spending more in interest than we get
            if (expectedInterest > 0 && expectedInterest < maxLoanWithdraw)
            {
                fixedSpendingOptions.push({
                    type:"increaseloan",
                    extraGuests: 0,
                    cost: -maxLoanWithdraw,
                    actionIncome: -expectedInterest,
                })
            }
            //this.activityLog.push(context.formatString("Loan increase: {CURRENCY} now for {CURRENCY} total interest", maxLoanWithdraw, expectedInterest));
        }

        let advertisingOptions: SpendingOption[]= [];
        if (canAdvertise)
        {
            advertisingOptions = this.buildAdvertisingSpendingOptions(strategy);
            fixedSpendingOptions.push(...advertisingOptions);
        }

        // The idea behind the spending decision loop:
        // 1) Each ad campaign can be run only once, and the effect of the campaign (cost, guests generated) are independent of everything else we do.
        // 2) Repaying loan can be done as many times as we want, but we only really want to look at it once because the cost to value ratio is always the same.
        // 3) The value of building rides goes all over the place because ad campaigns generate guests independently of the SGC, which means keeping ahead of ads as well is more expensive
        
        // This means that we can prebuild the ads and the loan, and after every commitment we need to stop and consider the ride building again.
        let purchasedItem = false;
        let iterations = 0;
        do
        {
            log(`Start outer spending loop`, "IndividualSim");
            purchasedItem = false;
            iterations++;
            let currentRideBuildingOption = this.getRideBuildingOption();
            let currentSpendingOptions = [...fixedSpendingOptions];
            // Pushing non-options risks them getting ranked and chosen for no gain
            // If our density limit is exceeded we aren't allowed to build anything either
            if (currentRideBuildingOption.cost > 0 && currentRideBuildingOption.softGuestCapIncrease > 0 && this.monthExceededDensityLimit === undefined)
            {
                //this.activityLog.push(context.formatString(`Ride building option: ${currentRideBuildingOption.softGuestCapIncrease} SGC for {CURRENCY}`, currentRideBuildingOption.cost));
                currentSpendingOptions.push(currentRideBuildingOption);
            }
            log(`Sort spending options`, "IndividualSim");
            let sortedSpendingOptions = sortSpendingOptions(currentSpendingOptions, strategy);
            for (let index in sortedSpendingOptions)
            {
                let opt = sortedSpendingOptions[index];
                // Once we get to the repay loan spending option, we're considering just throwing all our excess cash into it.
                if (opt.type === "repayloan")
                {
                    opt.cost = Math.min(this.unrepaidLoan, 10000 * Math.floor(maxProportionOfAvailableCashIntoLoanRepayment * this.cashAvailable / 10000));
                    opt.actionIncome = this.monthsLeft * monthWeeks * ((opt.cost * 5 * ScenarioSettings.loanInterest) >>> 14);
                    if (opt.cost <= 0)
                    {
                        continue;
                    }
                }
                if (this.cashAvailable >= opt.cost)
                {
                    log(`Buy spending option type ${opt.type}`, "IndividualSim");
                    this.activityLog.push(context.formatString("Cash available: {CURRENCY}", this.cashAvailable));
                    if (opt.type === "building")
                    {
                        let tilesToBuy = Math.min(this.buyableLand, Math.max(0, -1 * (this.availableLandForBuilding - opt.landTiles)));
                        this.buyableLand -= tilesToBuy;
                        this.totalLandBought += tilesToBuy;
                        this.availableLandForBuilding = Math.max(0, this.availableLandForBuilding - opt.landTiles);
                        this.totalLandUsage += opt.landTiles;
                        if (this.availableLandForBuilding <= 0)
                        {
                            //console.log(`having to buy land: total bought ${this.totalLandBought}, this time it cost ${opt.landCost}, rides cost ${opt.rideCost}, full cost ${opt.cost}`);
                        }
                        
                        this.softGuestCap += opt.softGuestCapIncrease;
                        this.activityLog.push(context.formatString(`Spent {CURRENCY} on building rides and {CURRENCY} buying land to fit them (${this.availableLandForBuilding} land left). SGC increased by ${opt.softGuestCapIncrease} to ${this.softGuestCap}`, opt.rideCost, opt.landCost));
                        this.cashAvailable -= opt.cost;
                    }
                    else if (opt.type === "advertising")
                    {
                        let carriedCash = ScenarioSettings.guestInitialCash;
                        if (opt.campaign === "freeEntry")
                        {
                            carriedCash = 0;
                        }
                        if (opt.campaign === "halfPriceEntry")
                        {
                            carriedCash /= 2;
                        }
                        this.addGuests(opt.extraGuests, carriedCash);
                        this.activityLog.push(`Spent ${opt.cost} on advertising: ${opt.campaign}, guests now ${this.guestsInPark}`);
                        this.cashAvailable -= opt.cost;
                    }
                    else if (opt.type === "repayloan")
                    {
                        this.cashAvailable -= opt.cost;
                        this.unrepaidLoan -= opt.cost;
                        this.activityLog.push(context.formatString("Repaid {CURRENCY} loan, now {CURRENCY} left", opt.cost, this.unrepaidLoan));
                    }
                    else if (opt.type === "increaseloan")
                    {
                        // opt.cost is negative for this option
                        this.cashAvailable -= opt.cost;
                        this.unrepaidLoan -= opt.cost;
                        this.activityLog.push(context.formatString("Increased loan by {CURRENCY}, total loan is now {CURRENCY}", -1*opt.cost, this.unrepaidLoan));
                    }
                    purchasedItem = true;
                    if (opt.type !== "building")
                    {
                        fixedSpendingOptions = fixedSpendingOptions.filter((option) => option != opt);
                    }
                    break;
                }
            }
            log(`Finished inner loop, bought something=${purchasedItem}`, "IndividualSim");
        } while (purchasedItem && iterations < 20);
        if (iterations == 20)
        {
            log(`DifficultySim.handleSpendingAndGuestGeneration iteration cap exceeded`, "Warning"); 
        }
        this.activityLog.push(context.formatString("Cash after spending: {CURRENCY}", this.cashAvailable));

        let naturalGuestGeneration = this.getNaturalGuestGeneration();
        this.addGuests(naturalGuestGeneration.current);
        this.activityLog.push(`Natural guest generation attracts ${naturalGuestGeneration.current}, guest count now ${this.guestsInPark}`);
        this.activityLog.push(context.formatString("Cash available: {CURRENCY}", this.cashAvailable));
    }

    handleGuestTurnover(strategy: SpendingStrategy, cashMachineAvailable: boolean)
    {
        let guestTurnover = getConfigOption("SimGuestTurnoverMinimum");
        let guestTurnoverFlat = 0;

        if (ScenarioSettings.payPerRide)
        {
            if (cashMachineAvailable)
            {
                // Minimum guest turnover is fine, we can keep working with that
                this.activityLog.push("Turnover strategy: minimum (cash machine available)");
            }
            else
            {
                this.activityLog.push("Turnover strategy: minimum (no cash machine available)");
                let brokeGuests = this.guestCountsByCash[0] || 0;
                // Even when out of cash it takes them a while to give up and go home
                guestTurnoverFlat = Math.round((getConfigOption("SimGuestBrokeLeaveProbability") * brokeGuests)/100);
                this.activityLog.push(`Turnover: ejected ${guestTurnoverFlat} broke guests`);
                this.guestCountsByCash[0] = Math.max(0, (this.guestCountsByCash[0] || 0) - guestTurnoverFlat);
            }
        }
        else
        {
            if (strategy == "profit")
            {
                // Pay-per-entry plus profit focus means max turnover
                guestTurnover = getConfigOption("SimGuestTurnoverMaximum");
                this.activityLog.push("Turnover strategy: maximum (profit strategy)");
            }
            else
            {
                this.activityLog.push("Turnover strategy: minimum (guestcount strategy)");
            }
        }

        this.guestsInPark -= guestTurnoverFlat;
        let turnoverRate = guestTurnover/100;
        guestTurnoverFlat = Math.round(this.guestsInPark*turnoverRate);
        // Assuming general turnover applies to all guest cash counts equally
        // If the cash machine is available this is pointless
        if (!cashMachineAvailable)
        {
            this.applyGeneralTurnoverToGuestCountsByCash(turnoverRate);
        }
        
        this.guestsInPark -= guestTurnoverFlat;
        this.activityLog.push(`Turnover: removed ${guestTurnoverFlat} guests, ${this.guestsInPark} remain`);
    }
}

export function initialStateDifficultySim(): DifficultySim
{
    let ds = new DifficultySim;
    ds.monthsLeft = 8 * ScenarioSettings.scenarioLength;
    // max - initial loans should always cancel out to zero, but just in case...
    ds.cashAvailable = ScenarioSettings.initialCash + (ScenarioSettings.maxLoan - ScenarioSettings.initialLoan);
    // Assume taking out max loan at start of scenario, the simulator can decide to repay part or all or nothing at all
    ds.unrepaidLoan = ScenarioSettings.maxLoan + ScenarioSettings.initialDebt;
    ds.softGuestCap = park.suggestedGuestMaximum;
    ds.guestsInPark = park.guests;
    ds.availableLandForBuilding = park.parkSize - ScenarioSettings.numOwnedTilesToBuyable;
    ds.buyableLand = MapAnalysis.buyableLand + MapAnalysis.buyableRights + ScenarioSettings.numOwnedTilesToBuyable + MapAnalysis.maxUnownedToPurchasableTiles;
    // Intentionally using nonmodified guestInitialCash value
    ds.guestCountsByCash[park.guestInitialCash] = park.guests;

    return ds;
}

// Notes on advertising strategy:
// ADVERTISING_CAMPAIGN_PARK_ENTRY_FREE - 50/week, 400 guestgen, 8 guestgen/£
// ADVERTISING_CAMPAIGN_PARK_RIDE_FREE - 50/week, 300 guestgen, 6 guestgen/£
// ADVERTISING_CAMPAIGN_PARK_ENTRY_HALF_PRICE - 50/week, 200 guestgen, 4 guestgen/£
// ADVERTISING_CAMPAIGN_PARK_FOOD_OR_DRINK_FREE - 50/week, 200 guestgen, 4 guestgen/£
// ADVERTISING_CAMPAIGN_PARK - 300/week, 250 guestgen, 1.2 guestgen/£
// ADVERTISING_CAMPAIGN_RIDE - 200/week, 200 guestgen, 1 guestgen/£

// These are quite clearly not created equal.
// 1) Using either entry free campaign hurts your cash flow, a lot, because guests enter and bypass your primary income source
// 2) Free ride and food/drink are the next winners, they give only one voucher and then you can continue to drain the guests' pockets after that.
// 3) Park/ride are the bottom of the pile.

// The game tries to operate at 40 game ticks per real second (at normal game speed, and slower if laggy etc)

// The current month tick counter increments up by 4 every game tick -> 160 per real second, so a month takes 65536/160 = 409.6s

// An ingame week takes 16383 month ticks, or ~4096 game ticks, or ~102.4s real time.

// The guestgen contribution of an advertising campaign divided by 65535 is the probability of spawning a guest on each tick.

// ADVERTISING_CAMPAIGN_PARK_ENTRY_FREE - 1 week costs 50 plus lost entry tickets, generates 25 guests
// ADVERTISING_CAMPAIGN_PARK_RIDE_FREE - 1 week costs 50 plus minor loss of 1 ticket on 1 ride, generates 18.75 guests -> each guest must spend £2.66 to profit
// ADVERTISING_CAMPAIGN_PARK_ENTRY_HALF_PRICE - 1 week costs 50 plus lost entry tickets, generates 12.5 guests -> profitable if full price park entry exceeds £8
// ADVERTISING_CAMPAIGN_PARK_FOOD_OR_DRINK_FREE - 1 week costs 50 plus 1 pretty negligible stall sale, generates 12.5 guests -> each guest must spend £2.93 to profit
// ADVERTISING_CAMPAIGN_PARK - 1 week costs 300, generates 15.63 guests -> each guest must spend £19.20 to profit
// ADVERTISING_CAMPAIGN_RIDE - 1 week costs 200, generates 12.5 guests -> each guest must spend £16 to profit

// So they can be grouped as:

// Free ride, food/drink, half price entry - pretty much a nobrainer to run continuously always
// Park/ride - more expensive, but unless guests are very poor or money is really tight due to other restrictions (and frankly, they may still be more worthwhile than
//             throwing money into rides for more soft guest cap generation!) these are still a nobrainer to run

// And the only campaign that might not be worth spamming all the time:
// Free park tickets - if you can't overcharge for umbrellas or it doesn't want to rain, this is the only campaign that could have quite a long payback time 


// Guest retention notes:

//my amity airfield save, 23rd june, 3008 guests, 4155 admissions, SGC = 2630 (so not really relevant)
// End of ads 8th august: no change = 3431 in park, 4715 admissions (137 left the park)
// Minus stalls: 3416 in park, 4705 admissions (142 left the park)

// Second round of ads: no stalls -> 16th march: 3388 in park, 5945 admissions (1410 left the park) - at this point my guest count is relatively stable
// ... tried again with no stall closures and I got about the same. But my guests were getting unhappy from litter and overcrowding

// -> 50 handymen, 71 entertainers, lots of bins

// Normal park: 4306 in park, 5843 admissions (390 total left the park, I started to have happiness problems when it rained)
// No stalls: 4176 in park, 5902 admissions (579 total left the park)

// At this point, ~10% of the guests are hungry but the majority leaving are unhappy from overcrowding

// ... more testing suggests that closing food stalls takes a very long time to do anything but does produce an undulating pattern of guest levels, but awards aren't helping
// in Arid heights, even with 3 awards I can't get over 2300 guests without food stalls
// The average is probably ~1700 or so

// This points to ditching stalls leading to ~10% of guests leaving every month over the long term, but it's not anywhere near that fast.