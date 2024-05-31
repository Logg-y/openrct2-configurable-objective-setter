import { DifficultyAdjuster, SimulationStatusReport } from "./difficultysimmanager";
import { MapAnalysis } from "./maptiles";
import { ScenarioSettings } from "./scenariosettings";
import { loadGameplayHooks } from "./hooks";
import { setParkStorageKey } from "./parkstorage";


// This value can be saved to park storage
// Leaving large amounts of numerical distance between values is intentional so that there is room to add intermediate states in the future
// without risking breaking backwards compatibility with old plugin version savedgames
// ... for now I'm not going to bother implementing save/reload properly recovering the state before SCENARIO_IN_PROGRESS
// but it's there in case it's useful for some reason, or for future intermediate states
export const enum RandomiserStates
{
    NOT_STARTED = 0,
    // A park starting with functional rides needs to wait a day for SGC calculations to be run
    // else the rando might run with SGC=0 even though it could be a LOT higher than that
    // Park size calc is also like this potentially
    WAITING_ENGINE_VALUES = 100,
    
    MAP_ANALYSIS_STARTED = 200,
    MAP_ANALYSIS_FINISHED = 300,


    // The settings might mean we want to go and scan the map to find out a lot about
    // how many tiles of land ownership are possible if we look beyond the bounds of what is normally available
    // ... but this is slow and a waste of time if the player doesn't that
    LANDOWNERSHIP_ANALYSIS_STARTED = 500,
    LANDOWNERSHIP_ANALYSIS_FINISHED = 600,
    
    DIFFICULTYSIM_COARSE = 700,
    DIFFICULTYSIM_FINISHED = 900,

    // The difficultysim will tell us how many tiles of land ownership to mess with
    // but working out which tiles and changing all their flags individually
    // is going to be a slow task in itself
    LANDOWNERSHIP_ASSIGNMENT_STARTED = 1000,
    LANDOWNERSHIP_ASSIGNMENT_FINISHED = 1100,
    // And then we have to fix the park fences to match the new land ownership.
    PARK_FENCE_RECONSTRUCTION_REMOVAL = 1200,
    PARK_FENCE_RECONSTRUCTION_STARTED = 1300,

    // Where the theoretical values are transferred to the real game values
    RANDOMISATION_FINAL = 1400,

    SCENARIO_IN_PROGRESS = 10000,
    SCENARIO_COMPLETED = 20000,
    SCENARIO_FAILED = 30000,

    RANDOMISATION_FAILED = 2147483646,

    // If someone loads a game after NOT_STARTED and before SCENARIO_IN_PROGRESS, we assign this high value
    // because there's a chance that something might be broken due to incomplete changes to eg land
    // thanks to save/quit in the middle and all the intemediates being lost
    RANDOMISATION_RUINED = 2147483647,
}

export var RandomiserState = RandomiserStates.NOT_STARTED;

var RandomiserTickUpdateHook: undefined | IDisposable = undefined;
var ActiveDifficultyManager = new DifficultyAdjuster;

function _tickRandomiser()
{
    if (RandomiserState == RandomiserStates.NOT_STARTED)
    {
        RandomiserState = RandomiserStates.WAITING_ENGINE_VALUES;
    }
    if (RandomiserState == RandomiserStates.WAITING_ENGINE_VALUES)
    {
        if (date.ticksElapsed % 40 > 0)
        {
            return;
        }
        let areThereOpenRides = false;
        if (map.numRides > 0)
        {
            
            for (let ride in map.rides)
            {
                if (map.rides[ride].status === "open")
                {
                    areThereOpenRides = true;
                    break;
                }
            }
        }
        if ((!areThereOpenRides || park.suggestedGuestMaximum > 0) && park.parkSize > 0)
        {
            console.log("Finished waiting for engine values, begin map analysis");
            RandomiserState = RandomiserStates.MAP_ANALYSIS_STARTED;
        }
    }
    else if (RandomiserState == RandomiserStates.MAP_ANALYSIS_STARTED)
    {
        if (MapAnalysis.analyseMap())
        {
            console.log("Map analysis finished");
            RandomiserState = RandomiserStates.MAP_ANALYSIS_FINISHED;
        }
    }
    else if (RandomiserState == RandomiserStates.MAP_ANALYSIS_FINISHED)
    {
        ScenarioSettings.rollRandom();
        RandomiserState = RandomiserStates.LANDOWNERSHIP_ANALYSIS_STARTED;
    }
    else if (RandomiserState == RandomiserStates.LANDOWNERSHIP_ANALYSIS_STARTED)
    {
        if (MapAnalysis.analyseMapAfterSettings())
        {
            RandomiserState = RandomiserStates.DIFFICULTYSIM_COARSE;
        }
    }
    else if (RandomiserState == RandomiserStates.DIFFICULTYSIM_COARSE)
    {
        let response = ActiveDifficultyManager.update();
        if (response == SimulationStatusReport.COMPLETE)
        {
            RandomiserState = RandomiserStates.DIFFICULTYSIM_FINISHED;
        }
        else if (response == SimulationStatusReport.IMPOSSIBLE)
        {
            RandomiserState = RandomiserStates.RANDOMISATION_FAILED;
        }
    }
    else if (RandomiserState == RandomiserStates.DIFFICULTYSIM_FINISHED)
    {
        ScenarioSettings.loadFinancialPressureSettings(ActiveDifficultyManager.finalSettings);
        RandomiserState = RandomiserStates.LANDOWNERSHIP_ASSIGNMENT_STARTED;
        // This object might still have a bunch of rather large arrays attached to it
        // Hopefully free them up
        ActiveDifficultyManager = new DifficultyAdjuster();
        console.log("Begin adjusting tile ownership...");
    }
    else if (RandomiserState == RandomiserStates.LANDOWNERSHIP_ASSIGNMENT_STARTED)
    {
        if (MapAnalysis.adjustTileOwnershipStates())
        {
            RandomiserState = RandomiserStates.PARK_FENCE_RECONSTRUCTION_REMOVAL;
            console.log("Maybe clearing park boundary fence...");
        }
    }
    else if (RandomiserState == RandomiserStates.PARK_FENCE_RECONSTRUCTION_REMOVAL)
    {
        if (MapAnalysis.clearParkBoundaryFence())
        {
            RandomiserState = RandomiserStates.PARK_FENCE_RECONSTRUCTION_STARTED;
            console.log("Maybe start reconstructing boundary fence...");
        }
    }
    else if (RandomiserState == RandomiserStates.PARK_FENCE_RECONSTRUCTION_STARTED)
    {
        if (MapAnalysis.rebuildParkBoundaryFence())
        {
            RandomiserState = RandomiserStates.RANDOMISATION_FINAL;
            console.log("Finalising...");
        }
    }
    else if (RandomiserState == RandomiserStates.RANDOMISATION_FINAL)
    {
        ScenarioSettings.finalise();
        RandomiserState = RandomiserStates.SCENARIO_IN_PROGRESS;
    }
    else
    {
        console.log("Done!");
        loadGameplayHooks();
        // Given this hook is what runs this function it can't be undefined here
        RandomiserTickUpdateHook?.dispose();
        RandomiserTickUpdateHook = undefined;
        setParkStorageKey("RandomisationState", RandomiserState);
    }
}

export function randomiser()
{
    if (RandomiserTickUpdateHook === undefined)
    {
        RandomiserTickUpdateHook = context.subscribe("interval.tick", _tickRandomiser);
    }
}