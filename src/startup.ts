import { loadGameplayHooks } from "./core/hooks";
import { getParkStorageKey } from "./core/parkstorage";
import { UIMain } from "./core/ui/uimain";
import { StringTable } from "./util/strings";

function onClickMenuItem(): void
{
	UIMain();
	let tile = map.getTile(34, 75);
	for (const idx in tile.elements)
	{
		let elem = tile.elements[idx];
		if (elem.type == "surface")
		{
			//park.postMessage(`fence ${elem.parkFences}`);
		}
	}
}


export function startup()
{
	// Write code here that should happen on startup of the plugin.

	

	// Register a menu item under the map icon:
	if (typeof ui !== "undefined")
	{
		ui.registerMenuItem(StringTable.PLUGIN_MENU_ITEM, () => onClickMenuItem());
	}
	let loadedState = getParkStorageKey("RandomisationState", 0);
	if (loadedState > 0)
	{
		loadGameplayHooks();
	}
}

