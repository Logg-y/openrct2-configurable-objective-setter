import { pluginversion } from "../../util/pluginversion";
import { tab, tabwindow, label, spinner, horizontal, WindowTemplate, WidgetCreator, FlexiblePosition, store, twoway, listview } from "openrct2-flexui";
import { StringTable, formatTokens } from "../../util/strings";
import { getParkStorageKey } from "../parkstorage";
import { labelWithExtendedHelpWrapper } from "./uiinclude";

// Not all rows will necessarily appear, so we define everything and the order they will appear in
// along with a function that decides if they appear or not
type PossibleTabElement = () => undefined | WidgetCreator<FlexiblePosition>;

function parkFlagBasedLabel(flag: ParkFlags, text: string): PossibleTabElement
{
    return () => { 
        if (!park.getFlag(flag)) return undefined;
        return label({
        text: text,
    })};
}

const MainTabElements: PossibleTabElement[] = [
    
    () => { return label({
        text: "{PALEGOLD}"+StringTable.RANDOMISER_STATE_SCENARIO_IN_PROGRESS,
    }); },
    () => { 
        let simValue = getParkStorageKey("SimAverageMonthlyCash", 0);
        let targetValue = getParkStorageKey("TargetSimAverageMonthlyCash", 0);
        let diff = simValue - targetValue;
        if (diff >= 0) return undefined;
        return label({text:context.formatString(StringTable.UI_COULD_NOT_ADJUST_FOR_TARGET_CASH, simValue, diff), height:36});
    },
    () => { 
        let labelText = StringTable.UI_OBJECTIVE;
        let height = 14;
        if (scenario.objective.type == "guestsAndRating")
        {
            labelText += context.formatString(formatTokens(StringTable.UI_OBJECTIVE_GUESTS_IN_PARK, String(scenario.objective.guests)), getParkStorageKey("ScenarioLength", 1)*8 - 1);
        }
        else if (scenario.objective.type == "repayLoanAndParkValue")
        {
            labelText += context.formatString(StringTable.UI_OBJECTIVE_REPAY_LOAN, scenario.objective.parkValue, getParkStorageKey("ScenarioLength", 1)*8 - 1);
            // This string contains a new line, need to leave more space else it looks cramped
            height = 24;
        }
        else
        {
            labelText += "Unhandled objective type " + scenario.objective.type;
        }
        return label({
        text: labelText,
        height: height,
    }); },
    parkFlagBasedLabel("freeParkEntry", StringTable.UI_OBJECTIVE_CONDITION_PAY_PER_RIDE),
    () => { 
        if (park.getFlag("freeParkEntry")) return undefined;
        return label({
        text: StringTable.UI_OBJECTIVE_CONDITION_PAY_FOR_ENTRY,
    }); },
    () => { 
        let mod = getParkStorageKey("LoanInterestModification", 0);
        if (mod == 0) return undefined;
        return label({
        text: formatTokens(StringTable.UI_OBJECTIVE_CONDITION_LOAN_MODIFICATION, mod.toFixed(3)),
    }); },
    () => { 
        let mod = getParkStorageKey("GuestInitialCash", park.guestInitialCash);
        if (mod == park.guestInitialCash) return undefined;
        return label({
        text: context.formatString(StringTable.UI_OBJECTIVE_CONDITION_GUEST_CASH_MODIFICATION, mod-100, mod+200),
    }); },
    parkFlagBasedLabel("forbidMarketingCampaigns", StringTable.UI_OBJECTIVE_CONDITION_FORBID_MARKETING),
    parkFlagBasedLabel("difficultGuestGeneration", StringTable.UI_OBJECTIVE_CONDITION_HARDER_GUEST_GENERATION),
    parkFlagBasedLabel("difficultParkRating", StringTable.UI_OBJECTIVE_CONDITION_HARDER_PARK_RATING),
    parkFlagBasedLabel("forbidHighConstruction", StringTable.UI_OBJECTIVE_CONDITION_FORBID_HIGH_CONSTRUCTION),
    parkFlagBasedLabel("forbidTreeRemoval", StringTable.UI_OBJECTIVE_CONDITION_FORBID_TREE_REMOVAL),
    parkFlagBasedLabel("preferLessIntenseRides", StringTable.UI_OBJECTIVE_CONDITION_LESS_INTENSE),
    parkFlagBasedLabel("preferMoreIntenseRides", StringTable.UI_OBJECTIVE_CONDITION_MORE_INTENSE),
    () => { 
        let mod = getParkStorageKey("GuestNarrowIntensity", false);
        if (!mod) return undefined;
        return labelWithExtendedHelpWrapper({
        text: StringTable.UI_OBJECTIVE_CONDITION_NARROW_INTENSITY_PREFERENCE,
        tooltip: StringTable.UI_GUEST_NARROW_INTENSITY_TOOLTIP,
        extendedHelp: StringTable.UI_GUEST_NARROW_INTENSITY_EXTHELP,
    }); },
    () => { 
        let mod = getParkStorageKey("GuestUmbrellaChance", 0);
        if (mod <= 0) return undefined;
        return label({
        text: formatTokens(StringTable.UI_OBJECTIVE_CONDITION_UMBRELLA_CHANCE, String(mod)),
    }); },
    () => { 
        return label({
        text: context.formatString(StringTable.UI_OBJECTIVE_CONDITION_MAX_LOAN, park.maxBankLoan),
    }); },
    () => { 
        return label({
        text: context.formatString(StringTable.UI_OBJECTIVE_CONDITION_LAND_COST, park.landPrice),
    }); },
];

function processPossibleTabElements(elems: PossibleTabElement[]): WidgetCreator<FlexiblePosition>[]
{
    let valid: WidgetCreator<FlexiblePosition>[] = [];
    for (const elem of elems)
    {
        let ret = elem();
        if (ret !== undefined)
        {
            valid.push(ret);
        }
    }
    return valid;
}

const simOutputImage: ImageAnimation =
{
	frameBase: 5205,
	frameCount: 16,
	frameDuration: 4,
}

var GameInProgressSimCurrentMonthStore = store<number>(0);
var GameInProgressSimCurrentYearStore = store<number>(1);
var GameInProgressSimCurrentLogEntry = store<string[]>([]);

const SIM_LOG_SLICE_SIZE = 70;

function updateSimLogEntry()
{
    let month = GameInProgressSimCurrentMonthStore.get();
    let year = GameInProgressSimCurrentYearStore.get();
    let monthIndex = (month % 8);
    let yearIndex = 8*((year-1) % getParkStorageKey("ScenarioLength", 1));
    let index = monthIndex + yearIndex;
    let stringArr = getParkStorageKey<string[][]>("SimActivityLog", [])[index];
    let newArr = [];
    for (const item of stringArr)
    {
        let slices = 0;
        while (true)
        {
            let thisSlice = item.slice(slices*SIM_LOG_SLICE_SIZE, (slices+1)*SIM_LOG_SLICE_SIZE);
            newArr.push(thisSlice);
            if (thisSlice.length < SIM_LOG_SLICE_SIZE)
            {
                break;
            }
            slices++;
        }
    }    
    GameInProgressSimCurrentLogEntry.set(newArr);
}

function validateYear(value: number, adjust: number)
{
    let maxYear = getParkStorageKey("ScenarioLength", 1);
    if (adjust > 0 && value > maxYear)
    {
        GameInProgressSimCurrentYearStore.set(1);
    }
    else if (adjust < 0 && value < 1)
    {
        GameInProgressSimCurrentYearStore.set(maxYear);
    }
    updateSimLogEntry();
}

var simulationAverageCashStore = store<string>("")

const simTabContent = [
    label({text:StringTable.UI_SIMULATION_INFO}),
    label({text: StringTable.UI_SIMULATION_EXAMINE_DESCRIPTION, height: 25}),
    label({text: simulationAverageCashStore, height: 25}),
    horizontal([label({text:StringTable.UI_SIMULATION_ADJUST_MONTH}),
        spinner({
            value: twoway(GameInProgressSimCurrentMonthStore),
            width: 100,
            format: (val: number) => { return context.formatString("{MONTH}", val % 8); },
            onChange: (val: number, adjust: number) => {
                if (adjust > 0 && val > 7)
                {
                    GameInProgressSimCurrentMonthStore.set(0);
                    GameInProgressSimCurrentYearStore.set(GameInProgressSimCurrentYearStore.get()+1);
                    validateYear(GameInProgressSimCurrentYearStore.get(), 1);
                }
                else if (adjust < 0 && val < 0)
                {
                    GameInProgressSimCurrentMonthStore.set(7);
                    GameInProgressSimCurrentYearStore.set(GameInProgressSimCurrentYearStore.get()-1);
                    validateYear(GameInProgressSimCurrentYearStore.get(), -1);
                }
                updateSimLogEntry();
            },
        })
    ]),
    horizontal([label({text:StringTable.UI_SIMULATION_ADJUST_YEAR}),
        spinner({
            value: twoway(GameInProgressSimCurrentYearStore),
            width: 100,
            onChange: validateYear,
        })
    ]),
    listview({
        items: GameInProgressSimCurrentLogEntry,        
    }),
]

let currentDensityStore = store(StringTable.UI_PARK_INFO_CURRENT_DENSITY);

function parkInfoUpdate()
{
    let tilesPer100 = "0";
    if (park.suggestedGuestMaximum > 0)
    {
        tilesPer100 = (100 * (park.parkSize/park.suggestedGuestMaximum)).toFixed(0);
    }
    currentDensityStore.set(formatTokens(StringTable.UI_PARK_INFO_CURRENT_DENSITY, tilesPer100))
}

const parkInfoImage: ImageAnimation =
{
	frameBase: 5229,
	frameCount: 8,
	frameDuration: 8,
}

const parkInfoContent = [
    label({text:StringTable.UI_CURRENT_PARK_INFO}),
    label({text:currentDensityStore}),
]


var builtGameInProgressUITemplate: WindowTemplate | undefined = undefined;

function buildGameInProgressUITemplate(): WindowTemplate
{
    if (builtGameInProgressUITemplate !== undefined)
    {
        return builtGameInProgressUITemplate;
    }
    let template = {
        title: `${StringTable.PLUGIN_MENU_ITEM} v${pluginversion}`,
        width: {value: 400, max: 10000},
        height: {value: 550, max: 10000},
        padding: 5,
        tabs: [
            tab({
                image: 5466,
                height: "auto",
                content: processPossibleTabElements(MainTabElements),
            }),
            tab({
                image: simOutputImage,
                height: 300,
                content: simTabContent,
            }),
            tab({
                image: parkInfoImage,
                height: "auto",
                content: parkInfoContent,
                onOpen: parkInfoUpdate,
                onUpdate: () => { if (date.ticksElapsed % 200 == 0) { parkInfoUpdate(); } }
            })
        ],
    }
    let simCash = getParkStorageKey("SimAverageMonthlyCash", 0);
    let target = getParkStorageKey("TargetSimAverageMonthlyCash", 0);
    simulationAverageCashStore.set(context.formatString(StringTable.UI_SIMULATION_AVERAGE_CASH, simCash, simCash-target, target));
    let window = tabwindow(template);
    builtGameInProgressUITemplate = window;
    return window;
}

export function UIGameInProgress()
{
    if (typeof ui !== "undefined")
    {
        buildGameInProgressUITemplate().open();
        updateSimLogEntry();
    }
}