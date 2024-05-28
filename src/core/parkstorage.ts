
const boolOptions =
[
    "AllowEarlyCompletion",
    "GuestNarrowIntensity",
    
] as const;
const numberOptions =
[
    "GuestUmbrellaChance",
    "RandomisationState",
    "GuestInitialCash",
    "LoanInterestModification",
    "ScenarioLength",
    "ObjectiveQuantity",
] as const;
const stringOptions =
[
] as const;

/*
interface ParkStorageMap
{
    [key: string]: number | boolean | string;
}
*/
type ParkStorageMap = Record<string, number|boolean|string>;

export type ParkStorageBooleanKey = typeof boolOptions[number];
export type ParkStorageNumberKey = typeof numberOptions[number];
export type ParkStorageStringKey = typeof stringOptions[number];

export type ParkStorageKey = ParkStorageBooleanKey | ParkStorageNumberKey | ParkStorageStringKey;

function isNumberKey(opt: ParkStorageKey): opt is ParkStorageNumberKey
{
    return numberOptions.filter((item) => item == opt).length > 0;
}

function isBooleanKey(opt: ParkStorageKey): opt is ParkStorageBooleanKey
{
    return boolOptions.filter((item) => item == opt).length > 0;
}


export function getParkStorageKey(opt: ParkStorageBooleanKey, defaultVal: boolean): boolean;
export function getParkStorageKey(opt: ParkStorageNumberKey, defaultVal: number): number;
export function getParkStorageKey(opt: ParkStorageStringKey, defaultVal: string): string;
export function getParkStorageKey(opt: ParkStorageKey, defaultVal: boolean|number|string): boolean | number | string
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
    else
    {
        return val as string;
    }
}

export function setParkStorageKey(opt: ParkStorageBooleanKey, val: boolean): void;
export function setParkStorageKey(opt: ParkStorageNumberKey, val: number): void;
export function setParkStorageKey(opt: ParkStorageStringKey, val: string): void;
export function setParkStorageKey(opt: ParkStorageKey, val: boolean|number|string): void
{
    let obj: ParkStorageMap | undefined = context.getParkStorage("ParkOptions").get("OptionsMap"); 
    let map: ParkStorageMap = {};
    if (obj !== undefined)
    {
        map = obj;
    }
    map[opt] = val;
}
