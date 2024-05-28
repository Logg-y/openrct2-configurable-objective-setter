import { StringTable } from "../util/strings";
import { setParkStorageKey } from "./parkstorage";

type FinancialStart = "nodebt" | "highinterest" | "highdebt";
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
        "step": -50,
    },
    "loaninterest":
    {
        // ScenarioSettings.rollRandom overwrites min bsaed on config
        "min": 1,
        "max": 100,
        "step": 0.5,
    },
    "landcost":
    {
        "min": 100,
        "max": 5000,
        "step": 50,
    },
    "forcebuyland":
    {
        "min": 0,
        // MapAnalysis.analyseMapAfterSettings will write this when the value is known
        "max": 0,
        "step": Math.floor(park.parkSize/70),
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
        "step": 30000,
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
    financialStart: FinancialStart,
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
    financialStart: "nodebt",
    financialPressures: [],
    umbrellaChance: 0,
    narrowIntensity: false,
    guestInitialCash: park.guestInitialCash,
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
        let noDebtWeight =  getConfigOption("FinancialStartWeightNoDebt");
        let highInterestWeight =  getConfigOption("FinancialStartWeightHighInterest");
        let highDebtWeight =  getConfigOption("FinancialStartWeightHighDebt");
        if (this.objectiveType === "repayLoanAndParkValue")
        {
            noDebtWeight = 0;
            highInterestWeight = 0;
        }
        roll = context.getRandom(0, noDebtWeight + highInterestWeight + highDebtWeight);
        if (roll < noDebtWeight)
        {
            this.financialStart = "nodebt";
        }
        else
        {
            roll -= noDebtWeight;
            if (roll < highInterestWeight)
            {
                this.financialStart = "highinterest";
            }
            else
            {
                this.financialStart = "highdebt";
            }
        }
        let numFinancialPressures = context.getRandom(getConfigOption("FinancialDifficultyMethodsMin"), 1 + getConfigOption("FinancialDifficultyMethodsMax"));
        while (true)
        {
            if (this.financialPressures.length >= numFinancialPressures)
            {
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
            if (getConfigOption("FinancialDifficultyLoanInterest") && this.financialPressures.indexOf("loaninterest") <= -1 && this.financialStart !== "nodebt")
            {
                eligiblePressures.push("loaninterest");
            }
            if (eligiblePressures.length == 0)
            {
                break;
            }
            let pickedIndex = context.getRandom(0, eligiblePressures.length);
            this.financialPressures.push(eligiblePressures[pickedIndex]);
            if (eligiblePressures[pickedIndex] == "forcebuyland") 
            {
                this.financialPressures.push("landcost");
                numFinancialPressures++;
            }
        }
        FinancialPressureParams.initialcash.max = getConfigOption("StartingCash") + 250000;
        FinancialPressureParams.loaninterest.min = getConfigOption("FinancialDifficultyMinInterestRate");
    },

    // Return the current ScenarioSettings parameter value for the given pressure.
    // (eg "initialcash" returns ScenarioSettings.initialCash)
    getValueFromFinancialPressure(pressure: FinancialPressure) : number
    {
        // Writing it this way has the advantage of this causing a TS error if new pressures are added
        // but aren't added to this
        let rec: Record<FinancialPressure, number> = {
            "landcost":this.landPrice,
            "forcebuyland":this.numOwnedTilesToBuyable,
            "guestcash":this.guestInitialCash,
            "loaninterest":this.loanInterest,
            "initialcash":this.initialCash,
            "initialdebt":this.initialDebt,
        };
        return rec[pressure]
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
        if (pressure == "guestcash") { this.guestInitialCash = val; }
        if (pressure == "loaninterest") { this.loanInterest = val; }
        if (pressure == "initialcash") { this.initialCash = val; }
        if (pressure == "forcebuyland") { this.numOwnedTilesToBuyable = val; }
        if (pressure == "initialdebt") { this.initialDebt = val; }
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
        }
        else
        {
            scenario.objective.type = "haveFun";
        }
        let oldDetails = scenario.details;
        scenario.details = oldDetails + StringTable.SCENARIO_DETAILS_FILLER;
        park.setFlag("freeParkEntry", !this.payPerRide);
        park.setFlag("difficultGuestGeneration", this.flags.indexOf("difficultGuestGeneration") > -1);
        park.setFlag("difficultParkRating", this.flags.indexOf("difficultParkRating") > -1);
        park.setFlag("forbidHighConstruction", this.flags.indexOf("forbidHighConstruction") > -1);
        park.setFlag("forbidLandscapeChanges", this.flags.indexOf("forbidLandscapeChanges") > -1);
        park.setFlag("forbidMarketingCampaigns", this.flags.indexOf("forbidMarketingCampaigns") > -1);
        park.setFlag("forbidTreeRemoval", this.flags.indexOf("forbidTreeRemoval") > -1);
        park.setFlag("noMoney", this.flags.indexOf("noMoney") > -1);
        park.setFlag("open", this.flags.indexOf("open") > -1);
        park.setFlag("preferLessIntenseRides", this.flags.indexOf("preferLessIntenseRides") > -1);
        park.setFlag("preferMoreIntenseRides", this.flags.indexOf("preferMoreIntenseRides") > -1);
        park.setFlag("scenarioCompleteNameInput", this.flags.indexOf("scenarioCompleteNameInput") > -1);
        park.setFlag("unlockAllPrices", this.flags.indexOf("unlockAllPrices") > -1);
        park.landPrice = this.landPrice;
        park.constructionRightsPrice = this.landPrice;
        park.bankLoan = this.initialLoan;
        park.maxBankLoan = this.maxLoan;
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
