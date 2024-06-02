import { loadGameplayHooks } from "./core/hooks";
import { getParkStorageKey, setParkStorageKey } from "./core/parkstorage";
import { UIPregame } from "./core/ui/uipregame";
import { UIGameInProgress } from "./core/ui/uigameinprogress";
import { StringTable } from "./util/strings";
import { RandomiserStates } from "./core/randomisermain";
import { UIRandomiserInProgress } from "./core/ui/uirandomiserinprogress";

function onClickMenuItem(): void
{
	let state = getParkStorageKey("RandomisationState", RandomiserStates.NOT_STARTED)
	if (state >= RandomiserStates.SCENARIO_IN_PROGRESS)
	{
		UIGameInProgress();
	}
	else if (state > RandomiserStates.NOT_STARTED || state == RandomiserStates.RANDOMISATION_RUINED)
	{
		UIRandomiserInProgress();
	}
	else
	{
		UIPregame();
	}
}


export function startup()
{
	// Register a menu item under the map icon:
	if (typeof ui !== "undefined")
	{
		ui.registerMenuItem(StringTable.PLUGIN_MENU_ITEM, () => onClickMenuItem());
	}
	let loadedState = getParkStorageKey("RandomisationState", 0);
	if (loadedState > 0 && loadedState < RandomiserStates.SCENARIO_IN_PROGRESS)
	{
		setParkStorageKey("RandomisationState", RandomiserStates.RANDOMISATION_RUINED);
	}
	else if (loadedState > 0)
	{
		loadGameplayHooks();
	}
}

