
const boolOptions =
[
    "GuestNarrowIntensity",
    
] as const;
const numberOptions =
[
    "GuestUmbrellaChance",
    "RandomisationState",
    "GuestInitialCash",
    "LoanInterestModification",
    "TargetLoanInterest",
    "ScenarioLength",
    "ObjectiveQuantity",
    "SimAverageMonthlyCash",
    "TargetSimAverageMonthlyCash",
] as const;
const stringOptions: string[] = [];
const otherOptions =
[
    "SimActivityLog"
] as const;

/*
interface ParkStorageMap
{
    [key: string]: number | boolean | string;
}
*/
type ParkStorageMap = Record<string, any>;

export type ParkStorageBooleanKey = typeof boolOptions[number];
export type ParkStorageNumberKey = typeof numberOptions[number];
export type ParkStorageStringKey = typeof stringOptions[number];
export type ParkStorageOtherKey = typeof otherOptions[number];

export type ParkStorageKey = ParkStorageBooleanKey | ParkStorageNumberKey | ParkStorageStringKey | ParkStorageOtherKey;

function isNumberKey(opt: ParkStorageKey): opt is ParkStorageNumberKey
{
    return numberOptions.filter((item) => item == opt).length > 0;
}

function isBooleanKey(opt: ParkStorageKey): opt is ParkStorageBooleanKey
{
    return boolOptions.filter((item) => item == opt).length > 0;
}
function isStringKey(opt: ParkStorageKey): opt is ParkStorageStringKey
{
    return stringOptions.filter((item) => item == opt).length > 0;
}


export function getParkStorageKey(opt: ParkStorageBooleanKey, defaultVal: boolean): boolean;
export function getParkStorageKey(opt: ParkStorageNumberKey, defaultVal: number): number;
export function getParkStorageKey(opt: ParkStorageStringKey, defaultVal: string): string;
export function getParkStorageKey<T>(opt: ParkStorageOtherKey, defaultVal: T): T;
export function getParkStorageKey<T>(opt: ParkStorageKey, defaultVal: boolean|number|string|T): boolean | number | string | T
{
    let obj: ParkStorageMap | undefined = context.getParkStorage("ParkOptions").get("OptionsMap"); 
    let map: ParkStorageMap = {};
    if (obj !== undefined)
    {
        map = obj;
    }
    let val = map[opt] || defaultVal;
    if (isNumberKey(opt))
    {
        return val as number;
    }
    else if (isBooleanKey(opt))
    {
        return val as boolean;
    }
    else if (isStringKey(opt))
    {
        return val as string;
    }
    else
    {
        return val as T;
    }
}

export function setParkStorageKey(opt: ParkStorageBooleanKey, val: boolean): void;
export function setParkStorageKey(opt: ParkStorageNumberKey, val: number): void;
export function setParkStorageKey(opt: ParkStorageStringKey, val: string): void;
export function setParkStorageKey<T>(opt: ParkStorageOtherKey, val: T): void;
export function setParkStorageKey(opt: ParkStorageKey, val: boolean|number|string): void
{
    let obj: ParkStorageMap | undefined = context.getParkStorage("ParkOptions").get("OptionsMap"); 
    let map: ParkStorageMap = {};
    if (obj !== undefined)
    {
        map = obj;
    }
    map[opt] = val;
    context.getParkStorage("ParkOptions").set("OptionsMap", map);
}
