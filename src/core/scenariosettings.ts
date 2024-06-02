import { StringTable } from "../util/strings";
import { setParkStorageKey } from "./parkstorage";

export type FinancialPressure = "guestcash" | "loaninterest" | "landcost" | "forcebuyland" | "initialcash" | "initialdebt";

// A type that holds settings for multiple FinancialPressures at once
export type FinancialPressureSettings = Partial<{[P in FinancialPressure]: number}>;


type FinancialPressureAdjustmentParams =
{
    "min": number | undefined,
    "max": number | undefined,
    // Internally a step of -1 makes the thing easier by 1
    // and +1 makes it harder by 1
    // So attributes that make the game easier with larger quantities of the thing adjusted (eg starting cash, guest cash) should have negative values!
    "step": number;
}

// Basic params for the different pressures.
// Some of these aren't used or are dependent on other things (eg if the sim doesn't need to buy any land, trying to adjust land cost is a waste of time)
export const FinancialPressureParams: Record<FinancialPressure, FinancialPressureAdjustmentParams> =
{
    "guestcash":
    {
        "min": 150,
        "max": 1500,
        "step": -1,
    },
    "loaninterest":
    {
        // ScenarioSettings.rollRandom overwrites min bsaed on config
        "min": 1,
        "max": 150,
        "step": 0.1,
    },
    "landcost":
    {
        "min": 100,
        // Setting this value too high will tend to make it force you to build only on your starting land...
        // It also makes deviating from the target density even slightly really punishing.
        "max": 1500,
        "step": 1,
    },
    "forcebuyland":
    {
        "min": 0,
        // MapAnalysis.analyseMapAfterSettings will write this when the value is known
        "max": 0,
        "step": Math.max(1, Math.floor(park.parkSize/1000)),
    },
    "initialcash":
    {
        "min": 50000,
        // ScenarioSettings.rollRandom writes this based on the user picked configs, it can't be finalised until they click run
        "max": undefined,
        "step": -5000,
    },
    "initialdebt":
    {
        "min": 0,
        "max": undefined,
        "step": 10000,
    },
}

const ATM_IDENTIFIER = "rct2.ride.atm1";

import { getConfigOption } from "./sharedstorage";

interface ScenarioSettingsType
{
    scenarioLength: number,
    payPerRide: boolean,
    objectiveType: ScenarioObjectiveType,
    flags: ParkFlags[],
    financialPressures: FinancialPressure[],
    umbrellaChance: number;
    narrowIntensity: boolean;
    cashMachineMonth: number | undefined;
    landPrice: number;
    guestInitialCash: number;
    loanInterest: number,
    initialLoan: number,
    initialDebt: number,
    maxLoan: number,
    objectiveQuantity: number,
    // How many owned tiles to switch to buyables to make the player spend on that too
    numOwnedTilesToBuyable: number,
    // How many unowned tiles we should make buyable in case the player needs more space
    numUnownedTilesToPurchasable: number
    // How many buyable or owned tiles to switch to unbuyable to restrict player space
    numOwnableTilesToMakeUnbuyable: number;
    initialCash: number,
    rollRandom(): void,
    adjustSettingsForFinancialPressure(pressure: FinancialPressure, amount: number, adjustType: "add" | "set"): void,
    getValueFromFinancialPressure(pressure: FinancialPressure) : number,
    loadFinancialPressureSettings(settings: FinancialPressureSettings) : void,
    getFinancialPressureSettings(): Record<FinancialPressure, number>,

    finalise(): void,
}

// Max research rate: every 32 ticks, 400 progress at max funding
// An item is finished once reaching 65535 four times, so game ticks to research = (65535*4*32)/400 = 20971
// So one item takes 20971/16384 = ~1.28 months
const researchItemsPerMonth = 1.28;

export function getCashMachineMonth(): number | undefined
{
    let allRides = objectManager.getAllObjects("ride");
    for (let ride in allRides)
    {
        let rideobj = allRides[ride];
        if (rideobj.identifier == ATM_IDENTIFIER)
        {
            console.log("Cash Machine is loaded.");
            
            if (park.research.isObjectResearched("ride", rideobj.index))
            {
                console.log("Cash Machine is already researched!");
                return 0;
            }
            
            let stallDepth = 0;
            for (let researchitem in park.research.uninventedItems)
            {
                let researchitemObj = park.research.uninventedItems[researchitem];
                if (researchitemObj.type == "ride")
                {
                    if (researchitemObj.category == "shop")
                    {
                        if (ride === String(researchitemObj.object))
                        {
                            let ret = Math.ceil(stallDepth*researchItemsPerMonth);
                            console.log("Cash Machine will be ready for month " + ret);
                            return ret;
                        }
                        stallDepth++;
                    }
                }
            }
            break;
        }
    }
    console.log("Cash Machine is unavailable");
    return undefined;
}

export function getGuestMinimumInitialCash()
{
    return ScenarioSettings.guestInitialCash - 100;
}

export var ScenarioSettings: ScenarioSettingsType =
{
    scenarioLength: -1,
    payPerRide: true,
    objectiveType: "haveFun",
    flags: [],
    financialPressures: [],
    umbrellaChance: 0,
    narrowIntensity: false,
    // Based on Arid Heights the game behaves like this even when set to 0, which isn't what the code seems to be saying but I don't really get it
    guestInitialCash: Math.max(150, park.guestInitialCash),
    landPrice: 800,
    loanInterest: 5,
    initialLoan: park.bankLoan,
    maxLoan: park.maxBankLoan,
    initialCash: 0,
    initialDebt: 0,
    objectiveQuantity: scenario.objective.guests,

    numOwnedTilesToBuyable: 0,
    numUnownedTilesToPurchasable: 0,
    numOwnableTilesToMakeUnbuyable: 0,

    cashMachineMonth: getCashMachineMonth(),


    rollRandom()
    {
        this.cashMachineMonth = getCashMachineMonth();
        this.flags = [],
        this.initialCash = getConfigOption("StartingCash");
        this.initialLoan = getConfigOption("StartingCash");
        this.maxLoan = getConfigOption("StartingCash");
        this.loanInterest = getConfigOption("ScenarioInterestRate"),
        this.scenarioLength = getConfigOption("ScenarioLength");
        this.payPerRide = context.getRandom(0, 100) < getConfigOption("PayPerRideChance");
        
        this.umbrellaChance = getConfigOption("GuestUmbrellaChance");
        this.narrowIntensity = context.getRandom(0, 100) < getConfigOption("GuestNarrowIntensity");

        let guestsByDateWeight = getConfigOption("ObjectiveWeightGuestsByDate");
        let repayLoanWeight = getConfigOption("ObjectiveWeightRepayLoan");
        if (context.getRandom(0, guestsByDateWeight+repayLoanWeight) < guestsByDateWeight)
        {
            this.objectiveType = "guestsAndRating";
        }
        else
        {
            this.objectiveType = "repayLoanAndParkValue";
            if (getConfigOption("RepayLoanForcePayPerRide"))
            {
                this.payPerRide = true;
            }
            let cashMachineSetting = getConfigOption("RepayLoanCashMachineSetting");
            if (cashMachineSetting === 1) // Always
            {
                objectManager.load(ATM_IDENTIFIER);
                this.cashMachineMonth = 0;
            }
            else if (cashMachineSetting === 2) // If unresearchable
            {
                if (this.cashMachineMonth === undefined)
                {
                    objectManager.load(ATM_IDENTIFIER);
                    this.cashMachineMonth = 0;
                }
            }
        }
        console.log(`Objective: ${this.objectiveType}`);

        let lowIntensityWeight = getConfigOption("IntensityPreferenceWeightLow");
        let highIntensityWeight = getConfigOption("IntensityPreferenceWeightHigh");
        let noPreferenceWeight = getConfigOption("IntensityPreferenceWeightNone");
        let roll = context.getRandom(0, lowIntensityWeight + highIntensityWeight + noPreferenceWeight);
        if (roll < lowIntensityWeight)
        {
            this.flags.push("preferLessIntenseRides");
        }
        else
        {
            roll -= lowIntensityWeight;
            if (roll < highIntensityWeight)
            {
                this.flags.push("preferMoreIntenseRides");
            }
        }

        if (context.getRandom(0, 100) < getConfigOption("ForbidAdvertisingChance"))
        {
            this.flags.push("forbidMarketingCampaigns");
        }
        if (context.getRandom(0, 100) < getConfigOption("HarderGuestGenerationChance"))
        {
            this.flags.push("difficultGuestGeneration");
        }
        if (context.getRandom(0, 100) < getConfigOption("HarderParkRatingChance"))
        {
            this.flags.push("difficultParkRating");
        }
        if (context.getRandom(0, 100) < getConfigOption("ForbidHighConstructionChance"))
        {
            this.flags.push("forbidHighConstruction");
        }
        if (context.getRandom(0, 100) < getConfigOption("ForbidTreeRemovalChance"))
        {
            this.flags.push("forbidTreeRemoval");
        }
        if (context.getRandom(0, 100) < getConfigOption("ForbidLandscapeChangesChance"))
        {
            this.flags.push("forbidLandscapeChanges");
        }
        let numFinancialPressures = context.getRandom(getConfigOption("FinancialDifficultyMethodsMin"), 1 + getConfigOption("FinancialDifficultyMethodsMax"));
        while (true)
        {
            if (this.financialPressures.length >= numFinancialPressures)
            {
                console.log(`got enough pressures: ${this.financialPressures.length}`);
                break;
            }
            let eligiblePressures: FinancialPressure[] = [];
            if (getConfigOption("FinancialDifficultyForceBuyLand") && this.financialPressures.indexOf("forcebuyland") <= -1)
            {
                eligiblePressures.push("forcebuyland");
            }
            if (getConfigOption("FinancialDifficultyGuestCash") && this.financialPressures.indexOf("guestcash") <= -1)
            {
                // If this is a pay per ride scenario and the cash machine is available from the start
                // This pressure will not really do anything significant
                // ... and the sim will happily waste electricity without realising that
                if (this.cashMachineMonth != 0 || !this.payPerRide)
                {
                    eligiblePressures.push("guestcash");
                }
            }
            // This option makes no sense in no debt starts
            if (getConfigOption("FinancialDifficultyLoanInterest") && this.financialPressures.indexOf("loaninterest") <= -1 && this.financialPressures.indexOf("initialdebt") > -1)
            {
                eligiblePressures.push("loaninterest");
            }
            if (getConfigOption("FinancialDifficultyStartDebt") && this.financialPressures.indexOf("initialdebt") <= -1)
            {
                eligiblePressures.push("initialdebt");
            }
            if (eligiblePressures.length == 0)
            {
                console.log(`no more eligible pressures to add`);
                break;
            }
            let pickedIndex = context.getRandom(0, eligiblePressures.length);
            console.log(`Add financial pressure: ${eligiblePressures[pickedIndex]}`);
            this.financialPressures.push(eligiblePressures[pickedIndex]);
            if (eligiblePressures[pickedIndex] == "forcebuyland") 
            {
                this.financialPressures.push("landcost");
                numFinancialPressures++;
            }
        }

        // Repay loan needs the initial debt to be messed with to make any sense at all
        if (this.objectiveType == "repayLoanAndParkValue" && this.financialPressures.indexOf("initialdebt") <= -1)
        {
            this.financialPressures.push("initialdebt");
        }


        FinancialPressureParams.initialcash.max = getConfigOption("StartingCash") + 250000;
        FinancialPressureParams.loaninterest.min = getConfigOption("FinancialDifficultyMinInterestRate");
        this.loanInterest = Math.max(FinancialPressureParams.loaninterest.min, this.loanInterest);
    },

    getFinancialPressureSettings(): Record<FinancialPressure, number>
    {
        let rec: Record<FinancialPressure, number> = {
            "landcost":this.landPrice,
            "forcebuyland":this.numOwnedTilesToBuyable,
            "guestcash":this.guestInitialCash,
            "loaninterest":this.loanInterest,
            "initialcash":this.initialCash,
            "initialdebt":this.initialDebt,
        };
        return rec;
    },

    // Return the current ScenarioSettings parameter value for the given pressure.
    // (eg "initialcash" returns ScenarioSettings.initialCash)
    getValueFromFinancialPressure(pressure: FinancialPressure) : number
    {
        return this.getFinancialPressureSettings()[pressure];
    },

    // Adjust the ScenarioSettings attribute(s) that correspond with FinancialPressure
    adjustSettingsForFinancialPressure(pressure: FinancialPressure, amount: number, adjustType: "add" | "set"): void
    {
        let val = amount;
        if (adjustType == "add")
        {
            val = this.getValueFromFinancialPressure(pressure) + val;
        }
        //console.log(`Set pressure ${pressure} to ${val} (mode=${adjustType}, amt=${amount})`);
        val = Math.max(FinancialPressureParams[pressure].min || val, Math.min(FinancialPressureParams[pressure].max || val, val));
        if (pressure == "landcost") { this.landPrice = val; }
        else if (pressure == "guestcash") { this.guestInitialCash = val; }
        else if (pressure == "loaninterest") { this.loanInterest = val; }
        else if (pressure == "initialcash") { this.initialCash = val; }
        else if (pressure == "forcebuyland") { this.numOwnedTilesToBuyable = val; }
        // At some point this can get large enough to introduce floating point rounding errors
        // Ideally we stay on round multiples of 1000
        else if (pressure == "initialdebt") { this.initialDebt = 10000 * Math.round(val/10000); }
    },

    loadFinancialPressureSettings(settings: FinancialPressureSettings)
    {
        let k: keyof FinancialPressureSettings;
        for (k in settings)
        {
            let val = settings[k];
            if (val !== undefined)
            {
                this.adjustSettingsForFinancialPressure(k, val, "set");
            }
        }
    },

    finalise()
    {
        if (this.objectiveType == "guestsAndRating")
        {
            scenario.objective.type = "guestsAndRating";
            scenario.objective.guests = this.objectiveQuantity;
            park.setFlag("open", true);
        }
        else
        {
            scenario.objective.type = "repayLoanAndParkValue";
            scenario.objective.parkValue = 100000;
        }
        let oldDetails = scenario.details;
        scenario.details = oldDetails + context.formatString(StringTable.SCENARIO_DETAILS_FILLER, this.scenarioLength*8-1);
        park.setFlag("freeParkEntry", this.payPerRide);
        park.setFlag("difficultGuestGeneration", this.flags.indexOf("difficultGuestGeneration") > -1);
        park.setFlag("difficultParkRating", this.flags.indexOf("difficultParkRating") > -1);
        park.setFlag("forbidHighConstruction", this.flags.indexOf("forbidHighConstruction") > -1);
        park.setFlag("forbidLandscapeChanges", this.flags.indexOf("forbidLandscapeChanges") > -1);
        park.setFlag("forbidMarketingCampaigns", this.flags.indexOf("forbidMarketingCampaigns") > -1);
        park.setFlag("forbidTreeRemoval", this.flags.indexOf("forbidTreeRemoval") > -1);
        park.setFlag("noMoney", this.flags.indexOf("noMoney") > -1);
        park.setFlag("preferLessIntenseRides", this.flags.indexOf("preferLessIntenseRides") > -1);
        park.setFlag("preferMoreIntenseRides", this.flags.indexOf("preferMoreIntenseRides") > -1);
        park.setFlag("scenarioCompleteNameInput", this.flags.indexOf("scenarioCompleteNameInput") > -1);
        park.setFlag("unlockAllPrices", this.flags.indexOf("unlockAllPrices") > -1);
        park.landPrice = this.landPrice;
        park.constructionRightsPrice = this.landPrice;
        park.bankLoan = this.initialLoan + this.initialDebt;
        park.maxBankLoan = this.maxLoan + this.initialDebt;
        park.cash = this.initialCash;
        date.monthsElapsed = 0;
        date.monthProgress = 0;
        setParkStorageKey("GuestUmbrellaChance", this.umbrellaChance);
        setParkStorageKey("GuestNarrowIntensity", this.narrowIntensity);
        setParkStorageKey("GuestInitialCash", this.guestInitialCash);
        setParkStorageKey("LoanInterestModification", this.loanInterest - getConfigOption("ScenarioInterestRate"));
        setParkStorageKey("ScenarioLength", this.scenarioLength);
        setParkStorageKey("ObjectiveQuantity", this.objectiveQuantity);
    }
}
