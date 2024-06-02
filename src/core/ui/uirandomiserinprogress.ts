import { window, label, store } from "openrct2-flexui"
import { StringTable } from "../../util/strings"
import { pluginversion } from "../../util/pluginversion";
import { RandomiserStates, ActiveDifficultyManager } from "../randomisermain";
import { MapAnalysis } from "../maptiles";
import { UIGameInProgress } from "./uigameinprogress";
import { getParkStorageKey } from "../parkstorage";

var randomiserStateText = store<string>(StringTable.RANDOMISER_STATE_NOT_STARTED);
var randomiserProgressText = store<string>("");

var lastKnownRandomiserState = RandomiserStates.NOT_STARTED;

const RandomiserStateToLabel: Record<number, string> =
{
    [RandomiserStates.NOT_STARTED]: StringTable.RANDOMISER_STATE_NOT_STARTED,
    [RandomiserStates.WAITING_ENGINE_VALUES]: StringTable.RANDOMISER_STATE_WAITING_ENGINE_VALUES,
    [RandomiserStates.MAP_ANALYSIS_STARTED]: StringTable.RANDOMISER_STATE_MAP_ANALYSIS,
    [RandomiserStates.MAP_ANALYSIS_FINISHED]: StringTable.RANDOMISER_STATE_MAP_ANALYSIS,
    [RandomiserStates.LANDOWNERSHIP_ANALYSIS]: StringTable.RANDOMISER_STATE_LANDOWNERSHIP_ANALYSIS,
    [RandomiserStates.DIFFICULTYSIM]: StringTable.RANDOMISER_STATE_DIFFICULTYSIM,
    [RandomiserStates.DIFFICULTYSIM_FINISHED]: StringTable.RANDOMISER_STATE_DIFFICULTYSIM,
    [RandomiserStates.LANDOWNERSHIP_ASSIGNMENT]: StringTable.RANDOMISER_STATE_LANDOWNERSHIP_ASSIGNMENT,
    [RandomiserStates.PARK_FENCE_REMOVAL]: StringTable.RANDOMISER_STATE_PARK_FENCE_REMOVAL,
    [RandomiserStates.PARK_FENCE_RECONSTRUCTION]: StringTable.RANDOMISER_STATE_PARK_FENCE_RECONSTRUCTION,
    [RandomiserStates.RANDOMISATION_FINAL]: StringTable.RANDOMISER_STATE_FINALISING,
    [RandomiserStates.SCENARIO_IN_PROGRESS]: StringTable.RANDOMISER_STATE_SCENARIO_IN_PROGRESS,
    [RandomiserStates.RANDOMISATION_FAILED]: StringTable.RANDOMISER_STATE_FAILED,
    [RandomiserStates.RANDOMISATION_RUINED]: StringTable.RANDOMISER_STATE_RUINED,
}

const RandomiserStateToProgress: Record<number, ()=>string> =
{
    [RandomiserStates.MAP_ANALYSIS_STARTED]: () => MapAnalysis.getProgress(),
    [RandomiserStates.LANDOWNERSHIP_ANALYSIS]: () =>MapAnalysis.getProgress(),
    [RandomiserStates.LANDOWNERSHIP_ASSIGNMENT]: () => MapAnalysis.getProgress(),
    [RandomiserStates.PARK_FENCE_REMOVAL]: () => MapAnalysis.getProgress(),
    [RandomiserStates.PARK_FENCE_RECONSTRUCTION]: () => MapAnalysis.getProgress(),
    [RandomiserStates.DIFFICULTYSIM]: () => ActiveDifficultyManager.getProgress(),
}

const UIRandomiser = window({
    title: `${StringTable.PLUGIN_MENU_ITEM} v${pluginversion}`,
    width: {value: 400, max: 10000},
    height: "auto",
	padding: 5,
    content: [
        label({text:StringTable.UI_WORKING}),
        label({text:StringTable.UI_WORKING_UNPAUSE}),
        label({text:randomiserStateText}),
        label({text:randomiserProgressText, height:25}),
    ],
    onUpdate: () => 
        {
            if (date.ticksElapsed % 5 == 0)
            {
                let state = getParkStorageKey("RandomisationState", RandomiserStates.NOT_STARTED);
                if (state != lastKnownRandomiserState)
                {
                    randomiserStateText.set(RandomiserStateToLabel[state] ?? `Unknown ${state}`);
                    if (RandomiserStateToProgress[state] === undefined)
                    {
                        randomiserProgressText.set("");
                    }
                    if (state == RandomiserStates.SCENARIO_IN_PROGRESS)
                    {
                        UIRandomiser.close();
                        UIGameInProgress();
                    }
                }
                let progressFunc = RandomiserStateToProgress[state];
                if (progressFunc !== undefined)
                {
                    let prefix = state == RandomiserStates.DIFFICULTYSIM ? StringTable.UI_WORKING_DIFFICULTYSIM_DIFFERENCE : StringTable.UI_WORKING_STAGE_PROGRESS;
                    randomiserProgressText.set(prefix + progressFunc());
                }
            }
        }
})

export function UIRandomiserInProgress()
{
    UIRandomiser.open();
}