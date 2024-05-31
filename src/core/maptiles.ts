/*
Look at the map and see:
1) How much space is there to work with (park.parkSize will give owned tiles, we also need to know how many more are buyable)
2) How many trees, if they are unremoveable then this affects how much stuff you can feasibly build
*/

import { ScenarioSettings, FinancialPressureParams } from "./scenariosettings";
import { getConfigOption } from "./sharedstorage";

// SurfaceElement.ownership looks like it's going to be a bitmask
const OWNERSHIP_CONSTRUCTION_RIGHTS_AVAILABLE = 64;
const OWNERSHIP_AVAILABLE = 128;
const OWNERSHIP_OWNED = 32;
const OWNERSHIP_CONSTRUCTION_RIGHTS_OWNED = 16;
// Any of these bits set means a player can own this tile and remove any tree that might be on it
const OWNERSHIP_TILE_IS_OWNABLE = OWNERSHIP_OWNED + OWNERSHIP_AVAILABLE;

// SmallSceneryObject.flags has this bit set if the "no tree removal" scenario option will stop you removing it
const SMALL_SCENERY_FLAG_IS_TREE = 268435456;

const LandRemovalFeatureAvoidanceDistance = 3;
const LandRemovalParkEntranceAvoidanceDistance = 15;


interface MapAnalysis
{
    // Number of tiles of buyable land
    buyableLand: number;
    // Number of tiles of buyable construction rights
    buyableRights: number;
    // Number of trees on currently owned land
    treeCount: number;
    // Number of trees on purchasable land
    treeCountOnPurchasable: number;
    // Calculates the above values, returns true if done and false if more calls are needed
    analyseMap(): boolean;
    // Estimate the soft guest cap if someone were to build a super dense park using all available buyable land/rights

    // After ScenarioSettings are rolled, we have more to do (calculating adjustedParkSize, working out how much land we can add/remove)
    analyseMapAfterSettings(): boolean;

    // park.parkSize after adjustment with scenario settings (eg forbidden high construction)
    adjustedParkSize: number,

    ownedToPurchasableTilesByDistance: Record<number, CoordsXY[]>,
    unownedToPurchasableTilesByDistance: Record<number, CoordsXY[]>,
    ownableToUnownedTilesByDistance: Record<number, CoordsXY[]>,

    maxOwnedToPurchasableTiles: number;
    maxUnownedToPurchasableTiles: number;
    maxOwnableToUnownableTiles: number;

    // For the distance calcs it make sense to just build a list of everything and
    // calc the distances at the end
    potentialOwnedToBuyableTiles: CoordsXY[],
    potentialUnownedToBuyableTiles: CoordsXY[],
    ownableTiles: CoordsXY[],
    containsParkEntrance: CoordsXY[],
    // An x/y map for whether or not a tile is too close to an owned piece of path or a ride
    ownedLandFeatureAvoidanceMap: boolean[][],
    parkFenceIsDirty: boolean;

    // Return true if done, or false if more needed
    adjustTileOwnershipStates(): boolean,

    clearParkBoundaryFence(): boolean,
    rebuildParkBoundaryFence(): boolean,
}

const SquaresPerTick = 400;

var lastX = 0;
var lastY = 0;

function distanceToNearestEntrance(point: CoordsXY, entrances:CoordsXY[])
{
    // dist = dx + dy makes the avoidance area a bit too "pointy" for my taste
    /*
    let lowest = entrances.reduce<undefined | number>((prior: undefined | number, entrance: CoordsXY) => {

        let thisDist = Math.abs(point.y - entrance.y) + Math.abs(point.x - entrance.x);
        if (prior === undefined) { return thisDist; }
        if (prior < thisDist)
        {
            return prior;
        }
        return thisDist;
    }, undefined)
    return lowest || NaN;
    */
    let squaredLowest = entrances.reduce<undefined | number>((prior: undefined | number, entrance: CoordsXY) => {

        let thisSquared = ((point.y - entrance.y) ** 2) + ((point.x - entrance.x) ** 2);
        if (prior === undefined) { return thisSquared; }
        if (prior < thisSquared)
        {
            return prior;
        }
        return thisSquared;
    }, undefined)
    return Math.ceil(Math.sqrt(squaredLowest || NaN));
}

function getHighestRecordKeys<T>(record: Record<number, T>)
{
    let keys = Object.keys(record).map((val: string) => Number(val)) as number[];
    return keys.reduce((accumulator: number, current: number) => { return current > accumulator ? current : accumulator; }, keys[0]);
}

function getLowestRecordKeys<T>(record: Record<number, T>)
{
    let keys = Object.keys(record).map((val: string) => Number(val)) as number[];
    return keys.reduce((accumulator: number, current: number) => { return current < accumulator ? current : accumulator; }, keys[0]);
}

function getTileSurfaceElement(tile: Tile)
{
    for (const idx in tile.elements)
    {
        let elem = tile.elements[idx];
        if (elem.type == "surface")
        {
            return elem;
        }
    }
    return undefined;
}

export const MapAnalysis: MapAnalysis =
{
    buyableLand: 0,
    buyableRights: 0,
    treeCount: 0,
    treeCountOnPurchasable: 0,
    adjustedParkSize: park.parkSize,
    ownedToPurchasableTilesByDistance: {},
    unownedToPurchasableTilesByDistance: {},
    ownableToUnownedTilesByDistance: {},

    maxOwnedToPurchasableTiles: 0,
    maxUnownedToPurchasableTiles: 0,
    maxOwnableToUnownableTiles: 0,

    potentialOwnedToBuyableTiles: [],
    potentialUnownedToBuyableTiles: [],
    containsParkEntrance: [],
    ownedLandFeatureAvoidanceMap: [],
    ownableTiles: [],
    parkFenceIsDirty: false,

    
    analyseMap()
    {
        if (lastX == 0 && lastY == 0)
        {
            this.buyableLand = 0;
            this.buyableRights = 0;
            this.treeCount = 0;
            this.treeCountOnPurchasable = 0;
        }
        let squaresLeft = SquaresPerTick;
        let y = lastY;
        let x = lastX;
        while (y < map.size.y)
        {
            while (x < map.size.x)
            {
                let tile = map.getTile(x, y);

                // The SurfaceElement always seems to come before the scenery, which is really convenient
                let isTileOwnable = false;
                let isTileOwned = false;
                // TODO: scenery sale value if/when fixed

                for (let i = 0; i < tile.numElements; i++) {
                    let element = tile.getElement(i);
                    if (element.type === 'small_scenery' || element.type == "large_scenery") {
                        let scenery = objectManager.getObject("small_scenery", element.object);
                        if (isTileOwnable && scenery.flags & SMALL_SCENERY_FLAG_IS_TREE)
                        {
                            if (isTileOwned)
                            {
                                this.treeCount++;
                            }
                            else
                            {
                                this.treeCountOnPurchasable++;
                            }
                        }
                    }
                    else if (element.type === 'surface')
                    {
                        isTileOwned = !!(element.ownership & OWNERSHIP_OWNED);
                        isTileOwnable = !!(element.ownership & OWNERSHIP_TILE_IS_OWNABLE);
                        if (element.ownership & OWNERSHIP_AVAILABLE)
                        {
                            this.buyableLand++;
                        }
                        else if (element.ownership & OWNERSHIP_CONSTRUCTION_RIGHTS_AVAILABLE)
                        {
                            this.buyableRights++;
                        }
                    }
                }
                squaresLeft--;
                x++;
                if (squaresLeft <= 0)
                {
                    break;
                }
            }
            if (squaresLeft > 0)
            {
                squaresLeft--;
                x = 0;
                y++;
            }
            if (squaresLeft <= 0)
            {
                lastX = x;
                lastY = y;
                return false;
            }
        }
        lastX = 0;
        lastY = 0;
        return true;
    },

    analyseMapAfterSettings()
    {
        if (lastX == 0 && lastY == 0)
        {
            if (ScenarioSettings.flags.indexOf("forbidTreeRemoval") > -1)
            {
                this.adjustedParkSize = Math.min(20, this.adjustedParkSize - this.treeCount * getConfigOption("SimForbidTreeRemovalSquareCost"));
            }
        }
        // We only care about the land constraints if...
        // 1) AllowNewLandBuying is enabled, then we need to chart the unowned map portions for what we could buy
        // 2) ShrinkSpace is enabled, then we need to chart the owned map portions for what we can remove
        // 3) forcebuyland FinancialDifficulty is in effect, then we need to chart owned map for what we can remove
        let chartUnowned = getConfigOption("AllowNewLandBuying");
        let chartOwned = getConfigOption("ShrinkSpace") || ScenarioSettings.financialPressures.indexOf("forcebuyland") > -1;

        // Bail early if the settings don't care
        if (!chartOwned && !chartUnowned)
        {
            return true;
        }

        let squaresLeft = SquaresPerTick;
        let y = lastY;
        let x = lastX;
        while (y < map.size.y)
        {
            while (x < map.size.x)
            {
                let tile = map.getTile(x, y);

                let isTileOwnable = false;
                let isTileOwned = false;
                let isTilePurchasable = false;

                // An unowned tile could be made buyable if...
                // 1) It does not contain a park entrance
                // 2) It does not touch the edge of the world
                // It might have to be construction rights, if it contains a piece of footpath that can't be removed without full ownership    

                // A piece of footpath can be removed from construction rights if it is below the surface element, or 3 "big" units above
                // a big unit is apparently 8 little units, and it looks like little is what is exposed to plugins as "baseZ"
                // ... or we use baseHeight which might just be easier, a quick test shows that 1 "game height" unit is 2 baseHeight or 16 baseZ

                // An owned tile could be converted to buyable if...
                // 1) It does not contain path
                // 2) It does not contain a ride
                // 3) It is not within some distance of any park entrance (eg: 15 tiles)
                // 4) It is not within some distance of a path/ride (eg 2 tiles)
                let considerOwnedToBuyable = chartOwned;
                let surfaceHeight: number | undefined = undefined;
                let isOwnedLandObstacle = false;
                let pathHeights = [];


                for (let i = 0; i < tile.numElements; i++) {
                    let element = tile.getElement(i);
                    if (element.type === "footpath") {
                        considerOwnedToBuyable = false;
                        pathHeights.push(element.baseHeight);
                        isOwnedLandObstacle = true;
                    }
                    else if (element.type == "entrance")
                    {
                        considerOwnedToBuyable = false;
                        // A quick dig shows that EntranceElement.object actually maps to EntranceElement::GetEntranceType which returns values of an enum...
                        // 0 = ride entrance, 1 = ride exit, 2 = park entrance
                        if (element.object == 2)
                        {
                            this.containsParkEntrance.push({x:x, y:y});
                        }
                        isOwnedLandObstacle = true;
                    }
                    else if (element.type === 'surface')
                    {
                        isTileOwned = !!(element.ownership & OWNERSHIP_OWNED);
                        isTileOwnable = !!(element.ownership & OWNERSHIP_TILE_IS_OWNABLE);
                        isTilePurchasable = !!(element.ownership & (OWNERSHIP_AVAILABLE + OWNERSHIP_CONSTRUCTION_RIGHTS_AVAILABLE)) && !isTileOwned;
                        surfaceHeight= element.baseHeight;
                    }
                    else if (element.type === "track")
                    {
                        considerOwnedToBuyable = false;
                        isOwnedLandObstacle = true;
                    }
                }
                if (considerOwnedToBuyable && isTileOwned)
                {
                    this.potentialOwnedToBuyableTiles.push({x:x, y:y});
                    this.ownableTiles.push({x:x, y:y});
                }
                else if (considerOwnedToBuyable && isTilePurchasable)
                {
                    this.ownableTiles.push({x:x, y:y});
                }
                if (chartOwned && isOwnedLandObstacle && isTileOwned)
                {
                    for (let x2 = x - LandRemovalFeatureAvoidanceDistance; x2 < x + LandRemovalFeatureAvoidanceDistance; x2++)
                    {
                        for (let y2 = y - LandRemovalFeatureAvoidanceDistance; y2 < y + LandRemovalFeatureAvoidanceDistance; y2++)
                        {
                            if (x2 > 0 && y2 > 0 && x2 < map.size.x && y2 < map.size.y)
                            {
                                this.ownedLandFeatureAvoidanceMap[x2] = this.ownedLandFeatureAvoidanceMap[x2] ?? [];
                                this.ownedLandFeatureAvoidanceMap[x2][y2] = true;
                            }
                        }
                    }   
                }
                if (chartUnowned && !isTileOwnable && !isTilePurchasable)
                {
                    if (x > 0 && x < map.size.x && y > 0 && y < map.size.y)
                    {
                        if (surfaceHeight !== undefined)
                        {
                            let valid = true;
                            for (const idx in pathHeights)
                            {
                                let height = pathHeights[idx];
                                if (height < surfaceHeight || height > surfaceHeight + 3)
                                {
                                    valid = false;
                                    break;
                                }
                            }
                            if (valid)
                            {
                                this.potentialUnownedToBuyableTiles.push({x:x, y:y});
                            }
                        }
                    }
                }

                squaresLeft--;
                x++;
                if (squaresLeft <= 0)
                {
                    break;
                }
            }
            if (squaresLeft > 0)
            {
                squaresLeft--;
            }
            if (x >= map.size.x)
            {
                x = 0;
                y++;
            }
            if (squaresLeft <= 0)
            {
                lastX = x;
                lastY = y;
                return false;
            }
        }
        lastX = x;
        lastY = y;

        console.log(`MapAnalysis late: ${this.potentialOwnedToBuyableTiles.length} potentially removable, ${this.potentialUnownedToBuyableTiles.length} potentially new buyable`);

        let abstractTileArrayToRecord = (record: Record<number, CoordsXY[]>, tileArray: CoordsXY[], maxAllowed: number, minEntranceDistance: number, validationFunction = (coords: CoordsXY) => { return coords.x >= 0; }): number =>
        {
            let maxIterations = Math.min(maxAllowed, tileArray.length);
            let iteration = 0;
            let numSuccessful = 0;
            // Because it only returns the number it succeeds at
            // This function is really doing maxAllowed SUCCESSFUL squares rather than all the ones it checks
            while (numSuccessful < maxIterations)
            {
                let coords = tileArray.pop();
                if (coords === undefined)
                {
                    break;
                }
                if (validationFunction(coords))
                {
                    let entranceDist = distanceToNearestEntrance(coords, this.containsParkEntrance);
                    if (isNaN(entranceDist) || entranceDist > minEntranceDistance)
                    {
                        let intDist = Math.round(entranceDist);
                        record[intDist] = record[intDist] ?? [];
                        record[intDist].push(coords);
                        numSuccessful++;
                    }
                }
                iteration++;
            }
            return numSuccessful;
        }

        let checkFeatureAvoidanceMap = (coords: CoordsXY) =>
        {
            if (this.ownedLandFeatureAvoidanceMap[coords.x] !== undefined)
            {
                return !(this.ownedLandFeatureAvoidanceMap[coords.x][coords.y] ?? false);
            }
            return true;
        }
        
        let added = abstractTileArrayToRecord(this.ownedToPurchasableTilesByDistance, this.potentialOwnedToBuyableTiles, squaresLeft, LandRemovalParkEntranceAvoidanceDistance, checkFeatureAvoidanceMap);
        this.maxOwnedToPurchasableTiles += added;
        squaresLeft -= added;
        if (squaresLeft <= 0)
        {
            return false;
        }

        added = abstractTileArrayToRecord(this.unownedToPurchasableTilesByDistance, this.potentialUnownedToBuyableTiles, squaresLeft, 2);
        this.maxUnownedToPurchasableTiles += added;
        squaresLeft -= added;
        if (squaresLeft <= 0)
        {
            return false;
        }

        added = abstractTileArrayToRecord(this.ownableToUnownedTilesByDistance, this.ownableTiles, squaresLeft, LandRemovalParkEntranceAvoidanceDistance, checkFeatureAvoidanceMap);
        this.maxOwnableToUnownableTiles += added;
        squaresLeft -= added;
        if (squaresLeft <= 0)
        {
            return false;
        }

        FinancialPressureParams.forcebuyland.max = this.maxOwnedToPurchasableTiles;

        console.log(`Unprocessed array items: ${this.ownableTiles.length + this.potentialOwnedToBuyableTiles.length + this.potentialUnownedToBuyableTiles.length}`);

        console.log(`analyseMapAfterSettings: ${this.maxOwnedToPurchasableTiles} tiles could be owned->purchasable, ${this.maxUnownedToPurchasableTiles} tiles could be unowned->purchasable, ${this.maxOwnableToUnownableTiles} could be owned/purchasable->unowned`)
        lastX = 0;
        lastY = 0;
        return true;

    },

    adjustTileOwnershipStates()
    {
        let abstractTileConverter = function(record: Record<number, CoordsXY[]>, maxAllowed: number, conversionFunction: (tile: Tile) => void, orderFunction=getHighestRecordKeys)
        {
            let totalConverted = 0;
            while (maxAllowed > 0)
            {
                let highestDist = orderFunction(record);
                if (highestDist === undefined)
                {
                    console.log(`WARNING: was asked to change ownership of ${maxAllowed} more tiles than we found were possible`);
                    return maxAllowed;
                }
                let numOfThisDist = record[highestDist].length;
                let numToChange = Math.min(maxAllowed, numOfThisDist);
                maxAllowed -= numToChange;
                if (numToChange == 0)
                {
                    break;
                }
                while (numToChange > 0)
                {
                    let tileCoords = record[highestDist].pop() as CoordsXY;
                    let tile = map.getTile(tileCoords.x, tileCoords.y);
                    conversionFunction(tile);
                    numToChange--;
                    totalConverted++;
                }
                if (record[highestDist].length == 0)
                {
                    delete record[highestDist];
                }
            }
            return totalConverted;
        }.bind(this);

        // It turns out that some tiles in some scenarios (Forest Frontiers!) have multiple bits set in a way that is nonsensical.
        // There's a strip of 5 or so tiles that have 160 = OWNERSHIP_OWNED + OWNERSHIP_AVAILABLE and that's a bit confusing
        // I did have these functions preserve most of the original bitmask, but that seems to cause more problems than it helps
        let squaresLeft = SquaresPerTick;

        console.log(`adjustTileOwnershipStates: ${ScenarioSettings.numOwnedTilesToBuyable} owned to buyable, ${ScenarioSettings.numUnownedTilesToPurchasable} unowned to buyable, ${ScenarioSettings.numOwnableTilesToMakeUnbuyable} owned to unbuyable`);

        let converted = abstractTileConverter(this.ownedToPurchasableTilesByDistance, Math.min(squaresLeft, ScenarioSettings.numOwnedTilesToBuyable), (tile) =>
        {
            for (const idx in tile.elements)
            {
                let element = tile.elements[idx];
                if (element.type == "surface")
                {
                    if ((element.ownership & OWNERSHIP_OWNED) > 0)
                    {
                        element.ownership = OWNERSHIP_AVAILABLE;
                        this.parkFenceIsDirty = true;
                    }
                    else if ((element.ownership & OWNERSHIP_CONSTRUCTION_RIGHTS_OWNED) > 0)
                    {
                        element.ownership = OWNERSHIP_CONSTRUCTION_RIGHTS_AVAILABLE;
                    }
                    break;
                }
            }
        });
        squaresLeft -= converted;
        ScenarioSettings.numOwnedTilesToBuyable -= converted;
        if (squaresLeft <= 0)
        {
            return false;
        }

        // We already screened tiles in this record - if they contain any path at all, we know we have to make it construction rights
        // not full ownership
        converted = abstractTileConverter(this.unownedToPurchasableTilesByDistance, Math.min(squaresLeft, ScenarioSettings.numUnownedTilesToPurchasable), (tile) =>
            {
                let surface: undefined | SurfaceElement;
                let hasPath = false;
                for (const idx in tile.elements)
                {
                    let element = tile.elements[idx];
                    if (element.type == "surface")
                    {
                        surface = element;
                    }
                    else if (element.type == "footpath")
                    {
                        hasPath = true;
                        if (surface !== undefined)
                        {
                            break;
                        }
                    }
                }
                if (surface !== undefined)
                {
                    if (hasPath)
                    {
                        surface.ownership = OWNERSHIP_CONSTRUCTION_RIGHTS_AVAILABLE;
                    }
                    else
                    {
                        surface.ownership = OWNERSHIP_AVAILABLE;
                    }
                }
            }, getLowestRecordKeys);
        squaresLeft -= converted;
        ScenarioSettings.numUnownedTilesToPurchasable -= converted;
        if (squaresLeft <= 0)
        {
            return false;
        }

        converted = abstractTileConverter(this.ownableToUnownedTilesByDistance, Math.min(squaresLeft, ScenarioSettings.numOwnableTilesToMakeUnbuyable), (tile) =>
            {
                for (const idx in tile.elements)
                {
                    let element = tile.elements[idx];
                    if (element.type == "surface")
                    {
                        if ((element.ownership & OWNERSHIP_OWNED) > 0)
                        {
                            this.parkFenceIsDirty = true;
                        }
                        // "can't be bought" is apparently just the absence of any of other bits
                        element.ownership = 0;
                        break;
                    }
                }
            });
        squaresLeft -= converted;
        ScenarioSettings.numOwnableTilesToMakeUnbuyable -= converted;
        if (squaresLeft <= 0)
        {
            return false;
        }

        
        return true;
    },

    clearParkBoundaryFence()
    {
        if (!this.parkFenceIsDirty)
        {
            console.log("No changes made to land ownership, no need to touch boundary fencing!")
            return true;
        }
        let squaresLeft = SquaresPerTick;
        let x = lastX;
        let y = lastY;
        while (x < map.size.x)
        {
            while (y < map.size.y)
            {
                let thisTile = getTileSurfaceElement(map.getTile(x, y));
                if (thisTile !== undefined)
                {
                    thisTile.parkFences = 0;
                }
                squaresLeft--;
                if (squaresLeft <= 0)
                {
                    lastX = x;
                    lastY = y;
                    return false;
                }
                y++;
            }
            y = 0;
            x++;
        }
        lastX = 0;
        lastY = 0;
        
        return true;
    },

    rebuildParkBoundaryFence()
    {
        if (!this.parkFenceIsDirty)
        {
            return true;
        }
        // These live on the tiles OUTSIDE the park bounds.
        // the coord+1 tile is the tile that is in the park
        // Y and Y+1: 1
        // X and X+1: 2
        // Y and Y-1: 4
        // X and X-1: 8
        let squaresLeft = SquaresPerTick;
        let x = lastX;
        let y = lastY;
        // These offsets are backwards because they are relative to the tile that's inside the park
        // whereas the observations above are compared to the tile outside
        const offsetList = [{y:-1, x:0}, {x:-1, y:0}, {y:1, x:0}, {x:1, y:0}];
        while (x < map.size.x)
        {
            while (y < map.size.y)
            {
                let thisTile = getTileSurfaceElement(map.getTile(x, y));
                squaresLeft--;
                if (thisTile !== undefined && (thisTile.ownership & OWNERSHIP_OWNED) > 0)
                {
                    let offsetIndex = 0;
                    while (offsetIndex < 4)
                    {
                        let offset = offsetList[offsetIndex];
                        let x2 = x + offset.x;
                        let y2 = y + offset.y;
                        if (x2 > 0 && x2 < map.size.x && y2 > 0 && y2 < map.size.y)
                        {
                            squaresLeft--;
                            let compareTile = getTileSurfaceElement(map.getTile(x2, y2));
                            if (compareTile !== undefined && (compareTile.ownership & OWNERSHIP_OWNED) == 0)
                            {
                                compareTile.parkFences |= 1 << offsetIndex;
                            }
                        }
                        offsetIndex++;
                    }
                }
                if (squaresLeft <= 0)
                {
                    lastX = x;
                    lastY = y;
                    return false;
                }
                y++;
            }
            y = 0;
            x++;
        }

        // Park entrance tiles should not have park fences on
        // (else a park fence "blocks" your entrance and it looks silly)
        for (const idx in this.containsParkEntrance)
        {
            let coords = this.containsParkEntrance[idx];
            let tile = getTileSurfaceElement(map.getTile(coords.x, coords.y));
            if (tile !== undefined)
            {
                tile.parkFences = 0;
            }
        }

        
        return true;
    },
}
