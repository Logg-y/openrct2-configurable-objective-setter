import { WritableStore } from "openrct2-flexui";

interface StoreMap
{
    [key: string]: WritableStore<number | boolean>;
}

// Use this for writing only. getConfigOption is the thing to use for reading values out of the UI stores
export const storeMap: StoreMap = {}

// This seems like a really unwieldy way to accomplish a typesafe lookup function that accepts either kind of option
const boolOptions =
[
    "RepayLoanForcePayPerRide",
    "AllowNewLandBuying",
    "ShrinkSpace",
    "FinancialDifficultyGuestCash",
    "FinancialDifficultyLoanInterest",
    "FinancialDifficultyForceBuyLand",
    "FinancialDifficultyStartDebt",

] as const;
const numberOptions =
[
    "GuestDifficulty",
    "CashTightness",
    "ScenarioLength",
    "PayPerRideChance",
    "ScenarioInterestRate",
    "StartingCash",
    "ObjectiveWeightGuestsByDate",
    "ObjectiveWeightRepayLoan",
    "RepayLoanCashMachineSetting",
    "ForbidAdvertisingChance",
    "HarderGuestGenerationChance",
    "HarderParkRatingChance",
    "ForbidHighConstructionChance",
    "ForbidTreeRemovalChance",
    "ForbidLandscapeChangesChance",
    "TilesPer100SGC",
    "TilesPer100SGCHardGuestGen",
    "ParkEntranceProtectionRadius",
    "ParkFeatureProtectionRadius",
    "FinancialDifficultyMethodsMin",
    "FinancialDifficultyMethodsMax",
    "FinancialDifficultyMinInterestRate",
    "IntensityPreferenceWeightNone",
    "IntensityPreferenceWeightHigh",
    "IntensityPreferenceWeightLow",
    "GuestUmbrellaChance",
    "GuestNarrowIntensity",
    "ActiveProfile",
    "SimGuestRideIncome",
    "SimGuestStallIncome",
    "SimCostPer100SGC",
    "SimCostPer100SGCHardGuestGen",
    "SimParkEntryPer100SGC",
    "SimRideUpkeepPer100SGC",
    "SimStaffWagesPer100SGC",
    "SimForbidTreeRemovalSquareCost",
    "SimForbidHighConstructionLandUsage",
    "SimGuestTurnoverMinimum",
    "SimGuestTurnoverMaximum",
    "SimGuestBrokeLeaveProbability",
    "SimMonthsPerTick",
] as const;


export type ConfigOptionBoolean = typeof boolOptions[number];
export type ConfigOptionNumber = typeof numberOptions[number];

export type ConfigOption = ConfigOptionBoolean | ConfigOptionNumber;

function isNumberOption(opt: ConfigOption): opt is ConfigOptionNumber
{
    return numberOptions.filter((item) => item == opt).length > 0;
}


export function getConfigOption(opt: ConfigOptionBoolean): boolean;
export function getConfigOption(opt: ConfigOptionNumber): number;
export function getConfigOption(opt: ConfigOption): boolean | number
{
    let obj = storeMap[opt];
    if (obj === undefined)
    {
        if (ui !== undefined)
        {
            throw new Error(`getConfigOption: unknown opt ${opt}`);
        }
        //return -1;
        return isNumberOption(opt) ? -1 : false;
    }
    if (isNumberOption(opt))
    {
        return storeMap[opt].get() as number;
    }
    else
    {
        return storeMap[opt].get() as boolean;
    }
}


type SavedMap = Record<string, number>;

export function loadStoreMap()
{
    let index = context.sharedStorage.get<number>("Loggy.ConfigurableObjectiveSetter.ActiveProfileIndex");
    if (index === undefined)
    {
        index = 1;
    }
    storeMap["ActiveProfile"].set(index);
    let savedMap = context.sharedStorage.get<SavedMap>("Loggy.ConfigurableObjectiveSetter.Profile" + String(index));
    if (savedMap === undefined)
    {
        return;
    }
    for (let key in savedMap)
    {
        // When removing or renaming store keys this attempts undefined.set
        // This is also a nice time to avoid clogging shared storage with stuff that's not active any more
        if (storeMap[key] === undefined)
        {
            console.log("Purging now unused key " + key);
            delete savedMap[key];
            context.sharedStorage.set<SavedMap>("Loggy.ConfigurableObjectiveSetter.Profile" + String(index), savedMap);
            continue;
        }
        // In shared storage bools become numbers
        // Flexui does not like bool bindings being set with numbers and throws a type mismatch error
        // in its internals (WidgetBinder._refresh) 
        // Setting up storeMap as string: WritableStore<boolean> | WritableStore<number> seems to cause other problems
        // but string: WritableStore<boolean | number> seemingly leaves no way to get the actual type out of the generic
        // ... but we know what type a store should be, because we created a store instances with default values and can just ask that if it's int or bool
        if (typeof storeMap[key].get() === "boolean")
        {
            storeMap[key].set(Boolean(savedMap[key]));
            //console.log(`loadStoreMap: ${key} -> ${Boolean(savedMap[key])}`)
        }
        else
        {
            storeMap[key].set(savedMap[key]);
            //console.log(`loadStoreMap: ${key} -> ${savedMap[key]}`)
        }
        
    }
}

export function saveStoreMap()
{
    let index = context.sharedStorage.get<number>("Loggy.ConfigurableObjectiveSetter.ActiveProfileIndex");
    if (index === undefined)
    {
        index = 1;
    }
    let savedMap: SavedMap = {};
    for (let key in storeMap)
    {
        savedMap[key] = Number(storeMap[key].get());
    }
    context.sharedStorage.set<SavedMap>("Loggy.ConfigurableObjectiveSetter.Profile" + String(index), savedMap);
}
