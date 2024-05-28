import { UIMain } from "./core/ui/uimain";

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
	let guests = map.getAllEntities("guest");
	for (let guestid in guests)
	{
		let guest = guests[guestid];
		guest.maxIntensity = Number(guestid) % 10;
		guest.minIntensity = Number(guestid) % 10;
	}
}


export function startup()
{
	// Write code here that should happen on startup of the plugin.

	

	// Register a menu item under the map icon:
	if (typeof ui !== "undefined")
	{
		ui.registerMenuItem("Park Objective Randomiser", () => onClickMenuItem());
	}
}

