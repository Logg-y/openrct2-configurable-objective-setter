/*
Look at the map and see:
1) How much space is there to work with (park.parkSize will give owned tiles, we also need to know how many more are buyable)
2) How many trees, if they are unremoveable then this affects how much stuff you can feasibly build
*/

import { ScenarioSettings, FinancialPressureParams } from "./scenariosettings";
import { getConfigOption } from "./sharedstorage";
import { log } from "../util/logging";

// SurfaceElement.ownership looks like it's going to be a bitmask
const OWNERSHIP_CONSTRUCTION_RIGHTS_AVAILABLE = 64;
const OWNERSHIP_AVAILABLE = 128;
const OWNERSHIP_OWNED = 32;
const OWNERSHIP_CONSTRUCTION_RIGHTS_OWNED = 16;
// Any of these bits set means a player can own this tile and remove any tree that might be on it
const OWNERSHIP_TILE_IS_OWNABLE = OWNERSHIP_OWNED + OWNERSHIP_AVAILABLE;

// SmallSceneryObject.flags has this bit set if the "no tree removal" scenario option will stop you removing it
const SMALL_SCENERY_FLAG_IS_TREE = 268435456;

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
    // 
    /**
     * Scans the map and records how many tiles of buyable land/rights and tree counts
     * @return {*}  {boolean} true if completed, false if more calls needed
     */
    analyseMap(): boolean;
    // Estimate the soft guest cap if someone were to build a super dense park using all available buyable land/rights

    /**
     * After ScenarioSettings are rolled, we have more to do (calculating adjustedParkSize, working out how much land we can add/remove)
     * @return {*}  {boolean} true if completed, false if more calls needed
     */
    assessPossibleOwnershipChanges(): boolean;

    /**
     * Component of assessPossibleOwnershipChanges that iterates over the map and looks at each tile's ownership states
     * @return {*}  {boolean}  true if completed, false if more calls needed
     */
    scanMapForOwnershipChanges(): boolean;

    /**
     * Find a valid value for this.parkCentralTile
     */
    calculateParkCentralTile(): CoordsXY;
    /**
     * Component of assessPossibleOwnershipChanges that processes the tile lists into records by distance that are useful for making actual modifications
     * @return {*}  {boolean}  true if completed, false if more calls needed
     */
    categoriseOwnershipChangesByDistance(): boolean;    

    // park.parkSize after adjustment with scenario settings (eg forbidden high construction)
    adjustedParkSize: number,

    ownedToPurchasableTilesByDistance: Record<number, CoordsXY[]>,
    unownedToPurchasableTilesByDistance: Record<number, CoordsXY[]>,
    ownableToUnownedTilesByDistance: Record<number, CoordsXY[]>,

    maxOwnedToPurchasableTiles: number;
    maxUnownedToPurchasableTiles: number;
    maxOwnableToUnownableTiles: number;

    // It turns out that Object.keys(record) and sorting this repeatedly is quite slow
    // as the records are not changing, we can just do it once and never again
    ownedToPurchasableSortedDistances: number[] | undefined,
    unownedToPurchasableTilesSortedDistances: number[] | undefined,
    ownableToUnownedTilesSortedDistances: number[] | undefined,

    // For the distance calcs it make sense to just build a list of everything and
    // calc the distances at the end
    potentialOwnedToBuyableTiles: CoordsXY[],
    potentialUnownedToBuyableTiles: CoordsXY[],
    ownableTiles: CoordsXY[],
    containsParkEntrance: CoordsXY[],
    // An x/y map for whether or not a tile is too close to an owned piece of path or a ride
    ownedLandFeatureAvoidanceMap: boolean[][],
    parkFenceIsDirty: boolean;

    /**
     * Adjusts tile ownership states based on the ScenarioSettings parameters
     * @return {*}  {boolean} true if completed, false if more calls needed
     */
    adjustTileOwnershipStates(): boolean,

    clearParkBoundaryFence(): boolean,
    rebuildParkBoundaryFence(): boolean,

    // Processing intermediates
    x: number;
    y: number;
    totalVanillaX: number;
    totalVanillaY: number;
    // How many more tiles etc we are allowed to process this iteration
    squaresLeft: number;
    // The tile closest to the midpoint of all playable land - when adding new buyable land, we want to search closest to this
    parkCentralTile: undefined | CoordsXY;
    // During changing tile ownerships: the initial number of tiles we have to work through. Otherwise, 0.
    totalRequestedTiles: number;
    /**
     * @return {*}  A string detailing what percentage of the current operation is complete, eg "50.4%"
     */
    getProgress(): string;

}

const SquaresPerTick = 400;

/**
 * @return {*} Squared distance between one and two
 */
function squaredDistanceBetween(one: CoordsXY, two: CoordsXY)
{
    return ((one.y - two.y) ** 2) + ((one.x - two.x) ** 2);
}
/**
 * @return {*} The squared distance between testPoint and the nearest point in list
 */
function squaredDistanceToClosestInList(testPoint: CoordsXY, list:CoordsXY[])
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
    let squaredLowest = list.reduce<undefined | number>((prior: undefined | number, thisPoint: CoordsXY) => {

        let thisSquared = squaredDistanceBetween(testPoint, thisPoint);
        if (prior === undefined) { return thisSquared; }
        if (prior < thisSquared)
        {
            return prior;
        }
        return thisSquared;
    }, undefined);
    // There's no need to actually calc the sqrt in the end, can just compare squared dists
    //return Math.ceil(Math.sqrt(squaredLowest || NaN));
    return squaredLowest || NaN;
}
/**
 * @return {*} The numerically largest key in record
 */
function getHighestRecordKey<T>(record: Record<number, T>)
{
    let keys = Object.keys(record).map((val: string) => Number(val)) as number[];
    return keys.reduce((accumulator: number, current: number) => { return current > accumulator ? current : accumulator; }, keys[0]);
}
/**
 * @return {*} The numerically smallest key in record
 */
function getLowestRecordKey<T>(record: Record<number, T>)
{
    let keys = Object.keys(record).map((val: string) => Number(val)) as number[];
    return keys.reduce((accumulator: number, current: number) => { return current < accumulator ? current : accumulator; }, keys[0]);
}

function getRecordKeysAscending<T>(record: Record<number, T>)
{
    let keys = Object.keys(record).map((val: string) => Number(val)) as number[];
    return keys.sort((a, b) => a - b);
}

function getRecordKeysDescending<T>(record: Record<number, T>)
{
    let keys = Object.keys(record).map((val: string) => Number(val)) as number[];
    return keys.sort((a, b) => -(a - b));
}

/**
 * @return {*} The Tile's surface element, or undefined if one wasn't found (this maybe isn't possible?)
 */
function getTileSurfaceElement(tile: Tile)
{
    for (const elem of tile.elements)
    {
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

    ownedToPurchasableSortedDistances: undefined,
    unownedToPurchasableTilesSortedDistances: undefined,
    ownableToUnownedTilesSortedDistances: undefined,

    potentialOwnedToBuyableTiles: [],
    potentialUnownedToBuyableTiles: [],
    containsParkEntrance: [],
    ownedLandFeatureAvoidanceMap: [],
    ownableTiles: [],
    parkFenceIsDirty: false,

    x: 0,
    y: 0,
    totalVanillaX: 0,
    totalVanillaY: 0,
    parkCentralTile: undefined,
    squaresLeft: 0,

    totalRequestedTiles: 0,
    

    
    analyseMap()
    {
        if (this.x == 0 && this.y == 0)
        {
            this.buyableLand = 0;
            this.buyableRights = 0;
            this.treeCount = 0;
            this.treeCountOnPurchasable = 0;
        }
        this.squaresLeft = SquaresPerTick;
        while (this.y < map.size.y)
        {
            while (this.x < map.size.x)
            {
                let tile = map.getTile(this.x, this.y);

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
                        // Some tiles have conflicting bitmasks. Assumed owned > ownable in all cases
                        isTileOwned = !!(element.ownership & OWNERSHIP_OWNED);
                        isTileOwnable = !!(element.ownership & OWNERSHIP_TILE_IS_OWNABLE) && !isTileOwned;
                        if (element.ownership & OWNERSHIP_AVAILABLE && !isTileOwned)
                        {
                            this.buyableLand++;
                        }
                        else if (element.ownership & OWNERSHIP_CONSTRUCTION_RIGHTS_AVAILABLE && !isTileOwned)
                        {
                            this.buyableRights++;
                        }
                        if (isTileOwnable || isTileOwned)
                        {
                            this.totalVanillaX += this.x;
                            this.totalVanillaY += this.y;
                        }
                    }
                }
                this.squaresLeft--;
                this.x++;
                if (this.squaresLeft <= 0)
                {
                    break;
                }
            }
            if (this.squaresLeft > 0)
            {
                this.squaresLeft--;
                this.x = 0;
                this.y++;
            }
            if (this.squaresLeft <= 0)
            {
                return false;
            }
        }
        this.x = 0;
        this.y = 0;
        return true;
    },

    scanMapForOwnershipChanges()
    {
        let chartUnowned = getConfigOption("AllowNewLandBuying");
        let chartOwned = getConfigOption("ShrinkSpace") || ScenarioSettings.financialPressures.indexOf("forcebuyland") > -1;
        this.squaresLeft = SquaresPerTick;
        let parkFeatureAvoidanceDistance = getConfigOption("ParkFeatureProtectionRadius");
        while (this.y < map.size.y)
        {
            while (this.x < map.size.x)
            {
                let tile = map.getTile(this.x, this.y);

                let isTileOwnable = false;
                let isTileOwned = false;
                let isTilePurchasable = false;

                // An unowned tile could be made buyable if...
                // 1) It does not contain a park entrance
                // 2) It does not touch the edge of the world
                // If it contains a piece of footpath that can be removed with construction rights, it can't be made buyable else you can connect to the path leading to your park!
                // If it contains path that can't be removed with construction rights, construction rights are okay

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
                            this.containsParkEntrance.push({x:this.x, y:this.y});
                        }
                        isOwnedLandObstacle = true;
                    }
                    else if (element.type === 'surface')
                    {
                        isTileOwned = !!(element.ownership & OWNERSHIP_OWNED);
                        isTileOwnable = !!(element.ownership & OWNERSHIP_TILE_IS_OWNABLE);
                        isTilePurchasable = !!(element.ownership & (OWNERSHIP_AVAILABLE + OWNERSHIP_CONSTRUCTION_RIGHTS_OWNED + OWNERSHIP_CONSTRUCTION_RIGHTS_AVAILABLE)) && !isTileOwned;
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
                    this.potentialOwnedToBuyableTiles.push({x:this.x, y:this.y});
                    this.ownableTiles.push({x:this.x, y:this.y});
                }
                else if (considerOwnedToBuyable && isTilePurchasable)
                {
                    this.ownableTiles.push({x:this.x, y:this.y});
                }
                if (chartOwned && isOwnedLandObstacle && isTileOwned)
                {
                    for (let x2 = this.x - parkFeatureAvoidanceDistance; x2 < this.x + parkFeatureAvoidanceDistance; x2++)
                    {
                        for (let y2 = this.y - parkFeatureAvoidanceDistance; y2 < this.y + parkFeatureAvoidanceDistance; y2++)
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
                    if (this.x > 0 && this.x < map.size.x && this.y > 0 && this.y < map.size.y)
                    {
                        if (surfaceHeight !== undefined)
                        {
                            let valid = true;
                            for (const height of pathHeights)
                            {
                                if (height < surfaceHeight || height > surfaceHeight + 3)
                                {
                                    valid = false;
                                    break;
                                }
                            }
                            if (valid)
                            {
                                this.potentialUnownedToBuyableTiles.push({x:this.x, y:this.y});
                            }
                        }
                    }
                }

                this.squaresLeft--;
                this.x++;
                if (this.squaresLeft <= 0)
                {
                    break;
                }
            }
            if (this.squaresLeft > 0)
            {
                this.squaresLeft--;
            }
            if (this.x >= map.size.x)
            {
                this.x = 0;
                this.y++;
            }
            if (this.squaresLeft <= 0)
            {
                return false;
            }
        }
        return true;
    },
    

    assessPossibleOwnershipChanges()
    {
        if (this.x == 0 && this.y == 0)
        {
            if (ScenarioSettings.flags.indexOf("forbidTreeRemoval") > -1)
            {
                this.adjustedParkSize = Math.max(20, this.adjustedParkSize - this.treeCount * getConfigOption("SimForbidTreeRemovalSquareCost"));
            }
        }
        this.squaresLeft = SquaresPerTick;

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

        if (!this.scanMapForOwnershipChanges())
        {
            return false;
        }

        if (!this.categoriseOwnershipChangesByDistance())
        {
            return false;
        }
        return true;
    },

    categoriseOwnershipChangesByDistance()
    {
        // 
        // For most things the distance is from the closest park entrance, we want to do things like make the furthest tiles from an entrance owned->buyable first
        // For unowned->buyable we want to measure from a park midpoint instead, starting around the park entrance (and going behind it!) is weird
        /**
         * Add to a record of <distance from something>:<list of coordinates> from a flat array of tile coordinates.
         * @param {Record<number, CoordsXY[]>} record Record to add to
         * @param {CoordsXY[]} tileArray Array of coordinates of tiles to process
         * @param {number} minAvoidanceDistance Discard tiles whose distance from the something <= this value
         * @param {boolean} [validationFunction=(_: CoordsXY) => { return true;}] Discard tiles for which this function returns false
         * @param {*} [getDistanceForCoords=(point: CoordsXY) => { return squaredDistanceToClosestInList(point, this.containsParkEntrance);}] Function to calculate distance for each tile
         * @return {*}  {number} Number of tiles added to the record
         */
        let tileArrayToDistanceSortedRecord = (record: Record<number, CoordsXY[]>, tileArray: CoordsXY[], minAvoidanceDistance: number, validationFunction = (_: CoordsXY) => { return true;}, getDistanceForCoords=(point: CoordsXY) => { return squaredDistanceToClosestInList(point, this.containsParkEntrance);} ): number =>
        {
            let maxIterations = Math.min(this.squaresLeft, tileArray.length);
            let numSuccessful = 0;
            // Because it only returns the number it succeeds at
            // This function is really doing maxAllowed SUCCESSFUL squares rather than all the ones it checks
            let avoidanceDistanceSquare = minAvoidanceDistance * minAvoidanceDistance;
            while (numSuccessful < maxIterations)
            {
                let coords = tileArray.pop();
                if (coords === undefined)
                {
                    break;
                }
                if (validationFunction(coords))
                {
                    let entranceDist = getDistanceForCoords(coords);
                    if (isNaN(entranceDist) || entranceDist > avoidanceDistanceSquare)
                    {
                        let intDist = Math.round(entranceDist);
                        record[intDist] = record[intDist] ?? [];
                        record[intDist].push(coords);
                        numSuccessful++;
                    }
                }
                this.squaresLeft--;
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
        
        let added = tileArrayToDistanceSortedRecord(this.ownedToPurchasableTilesByDistance, this.potentialOwnedToBuyableTiles, getConfigOption("ParkEntranceProtectionRadius"), checkFeatureAvoidanceMap);
        this.maxOwnedToPurchasableTiles += added;
        if (this.squaresLeft <= 0)
        {
            return false;
        }

        if (this.parkCentralTile === undefined && this.potentialUnownedToBuyableTiles.length > 0)
        {
            this.parkCentralTile = this.calculateParkCentralTile();
            log(`Park central tile: ${this.parkCentralTile.x}, ${this.parkCentralTile.y}`, "Info");
        }
        
        // minAvoidanceDistance in this case is around the park midpoint - so 0 is okay
        // we want to avoid making anything TOO close to the park entrances buyable though, hence the validation function with hardcoded radius of 2
        added = tileArrayToDistanceSortedRecord(this.unownedToPurchasableTilesByDistance, this.potentialUnownedToBuyableTiles, 0, (point: CoordsXY) =>
        {
            return squaredDistanceToClosestInList(point, this.containsParkEntrance) > 2*2;
        },
        (point: CoordsXY) =>
        {
            return squaredDistanceBetween(point, this.parkCentralTile as CoordsXY);
        }
        );
        this.maxUnownedToPurchasableTiles += added;
        if (this.squaresLeft <= 0)
        {
            return false;
        }

        added = tileArrayToDistanceSortedRecord(this.ownableToUnownedTilesByDistance, this.ownableTiles, getConfigOption("ParkEntranceProtectionRadius"), checkFeatureAvoidanceMap);
        this.maxOwnableToUnownableTiles += added;
        if (this.squaresLeft <= 0)
        {
            return false;
        }

        FinancialPressureParams.forcebuyland.max = this.maxOwnedToPurchasableTiles;

        let unprocessed = this.ownableTiles.length + this.potentialOwnedToBuyableTiles.length + this.potentialUnownedToBuyableTiles.length;
        if (unprocessed > 0)
        {
            log(`Unprocessed array items: ${unprocessed}`, "Warning");
        }

        log(`Map ownership analysis: ${this.maxOwnedToPurchasableTiles} tiles could be owned->purchasable, ${this.maxUnownedToPurchasableTiles} tiles could be unowned->purchasable, ${this.maxOwnableToUnownableTiles} could be owned/purchasable->unowned`, "Info");
        this.x = 0;
        this.y = 0;
        return true;

    },

    adjustTileOwnershipStates()
    {
        // A few bugs seem to be capable of causing this - and the results are not pretty (eg turning the whole map buyable for no good reason)
        if (ScenarioSettings.numOwnedTilesToBuyable < 0) { log(`numOwnedTilesToBuyable was ${ScenarioSettings.numOwnedTilesToBuyable}!`, "Error"); ScenarioSettings.numOwnedTilesToBuyable = 0; }
        if (ScenarioSettings.numUnownedTilesToPurchasable < 0) { log(`numUnownedTilesToPurchasable was ${ScenarioSettings.numUnownedTilesToPurchasable}!`, "Error"); ScenarioSettings.numUnownedTilesToPurchasable = 0;  }
        if (ScenarioSettings.numOwnableTilesToMakeUnbuyable < 0) { log(`numOwnableTilesToMakeUnbuyable was ${ScenarioSettings.numOwnableTilesToMakeUnbuyable}!`, "Error"); ScenarioSettings.numOwnableTilesToMakeUnbuyable = 0; }

        if (this.totalRequestedTiles == 0)
        {
            this.totalRequestedTiles = ScenarioSettings.numOwnedTilesToBuyable + ScenarioSettings.numUnownedTilesToPurchasable + ScenarioSettings.numOwnableTilesToMakeUnbuyable;
            log(`Change tile ownership: ${ScenarioSettings.numOwnedTilesToBuyable} owned to buyable, ${ScenarioSettings.numUnownedTilesToPurchasable} unowned to buyable, ${ScenarioSettings.numOwnableTilesToMakeUnbuyable} owned to unbuyable`, "Info");
        }

        // These operations are seemingly quite expensive, and so doing them once (and keeping them) makes this run a LOT faster
        // On large maps with a ton of owned land, doing this made this segment run ~100x faster
        this.squaresLeft = SquaresPerTick;

        if (this.unownedToPurchasableTilesSortedDistances === undefined)
            this.unownedToPurchasableTilesSortedDistances = getRecordKeysDescending(this.unownedToPurchasableTilesByDistance);
        if (this.ownedToPurchasableSortedDistances === undefined)
            this.ownedToPurchasableSortedDistances = getRecordKeysAscending(this.ownedToPurchasableTilesByDistance);
        if (this.ownableToUnownedTilesSortedDistances === undefined)
            this.ownableToUnownedTilesSortedDistances = getRecordKeysAscending(this.ownableToUnownedTilesByDistance);

        let abstractTileConverter = (record: Record<number, CoordsXY[]>, maxToConvert: number, conversionFunction: (tile: Tile) => void, sortedKeys: number[]) =>
        {
            let totalConverted = 0;
            let numToConvert = Math.min(this.squaresLeft, maxToConvert);
            if (numToConvert == 0)
                return 0;

            while (numToConvert > 0)
            {
                let highestDist = sortedKeys.pop();
                if (highestDist === undefined)
                {
                    log(`Was asked to change ownership of ${maxToConvert} more tiles than we found were possible`, "Info");
                    return totalConverted;
                }
                let numOfThisDist = record[highestDist].length;
                let numToChangeOfThisDist = Math.min(numToConvert, numOfThisDist);
                if (numToChangeOfThisDist == 0)
                {
                    break;
                }
                while (numToChangeOfThisDist > 0)
                {
                    let tileCoords = record[highestDist].pop() as CoordsXY;
                    let tile = map.getTile(tileCoords.x, tileCoords.y);
                    conversionFunction(tile);
                    numToChangeOfThisDist--;
                    totalConverted++;
                    numToConvert--;
                    this.squaresLeft--;
                }
                if (record[highestDist].length == 0)
                {
                    delete record[highestDist];
                }
                else
                {
                    sortedKeys.push(highestDist);
                }
            }
			console.log(`converted total ${totalConverted}`);
            return totalConverted;
        };
		console.log(`start owned to buyable: ${ScenarioSettings.numOwnedTilesToBuyable} ${this.squaresLeft}`);
        // It turns out that some tiles in some scenarios (Forest Frontiers!) have multiple bits set in a way that is nonsensical.
        // There's a strip of 5 or so tiles that have 160 = OWNERSHIP_OWNED + OWNERSHIP_AVAILABLE and that's a bit confusing
        // I did have these functions preserve most of the original bitmask, but that seems to cause more problems than it helps
        let converted = abstractTileConverter(this.ownedToPurchasableTilesByDistance, ScenarioSettings.numOwnedTilesToBuyable, (tile) =>
        {
            for (const element of tile.elements)
            {
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
        }, this.ownedToPurchasableSortedDistances);
        ScenarioSettings.numOwnedTilesToBuyable -= converted;
        if (this.squaresLeft <= 0)
        {
            return false;
        }
		console.log("start unowned to buyable");
        // We already screened tiles in this record - if they contain any path at all, we know we have to make it construction rights
        // not full ownership
        converted = abstractTileConverter(this.unownedToPurchasableTilesByDistance, ScenarioSettings.numUnownedTilesToPurchasable, (tile) =>
            {
                let surface: undefined | SurfaceElement;
                let hasPath = false;
                for (const element of tile.elements)
                {
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
            }, this.unownedToPurchasableTilesSortedDistances);
        ScenarioSettings.numUnownedTilesToPurchasable -= converted;
        if (this.squaresLeft <= 0)
        {
            return false;
        }
		
		console.log("start ownable to notbuyable");
        converted = abstractTileConverter(this.ownableToUnownedTilesByDistance, ScenarioSettings.numOwnableTilesToMakeUnbuyable, (tile) =>
            {
                for (const element of tile.elements)
                {
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
            }, this.ownableToUnownedTilesSortedDistances);
        ScenarioSettings.numOwnableTilesToMakeUnbuyable -= converted;
        if (this.squaresLeft <= 0)
        {
            return false;
        }
        this.totalRequestedTiles = 0;

        this.unownedToPurchasableTilesSortedDistances = undefined;
        this.ownedToPurchasableSortedDistances = undefined;
        this.ownableToUnownedTilesSortedDistances = undefined;

        return true;
    },

    calculateParkCentralTile(): CoordsXY
    {
        let midX = Math.round(this.totalVanillaX/(park.parkSize + this.buyableLand + this.buyableRights));
        let midY = Math.round(this.totalVanillaY/(park.parkSize + this.buyableLand + this.buyableRights));
        let dist = 0;
        while (true)
        {
            // Start at the midpoint, try to find any tile that is owned/buyable
            // Each step we go outwards looking, we only need search the "unfilled square" that is made of tiles we didn't check before
            let squareSideLength = 1 + dist * 2;
            let toSearch: CoordsXY[] = [];
            for (let k=0; k<squareSideLength; k++) { toSearch.push({x: midX+dist+k, y:midY-dist})}
            for (let k=0; k<squareSideLength; k++) { toSearch.push({x: midX+dist+k, y:midY+dist})}
            // Deliberately going from 1 to (length-1) to avoid duplicating corners
            for (let k=1; k<squareSideLength-1; k++) { toSearch.push({x: midX+dist, y:midY-dist+k})}
            for (let k=1; k<squareSideLength-1; k++) { toSearch.push({x: midX+dist, y:midY-dist-k})}

            for (const coords of toSearch)
            {
                let surface = getTileSurfaceElement(map.getTile(coords.x, coords.y));
                if (surface !== undefined)
                {
                    if ((surface.ownership & (OWNERSHIP_OWNED + OWNERSHIP_AVAILABLE + OWNERSHIP_CONSTRUCTION_RIGHTS_AVAILABLE + OWNERSHIP_CONSTRUCTION_RIGHTS_OWNED)) > 0)
                    {
                        return coords;
                    }
                }
                this.squaresLeft--;
            }

            dist++;

            // Safety exit condition that SHOULD never happen
            if (squareSideLength >= map.size.x && squareSideLength >= map.size.y)
            {
                if (this.containsParkEntrance.length > 0)
                {
                    return this.containsParkEntrance[0];
                }
                return {x:0, y:0}
            }
        }
    },

    clearParkBoundaryFence()
    {
        if (!this.parkFenceIsDirty)
        {
            return true;
        }
        this.squaresLeft = SquaresPerTick;
        while (this.y < map.size.y)
        {
            while (this.x < map.size.x)
            {
                let thisTile = getTileSurfaceElement(map.getTile(this.x, this.y));
                if (thisTile !== undefined)
                {
                    thisTile.parkFences = 0;
                }
                this.squaresLeft--;
                if (this.squaresLeft <= 0)
                {
                    return false;
                }
                this.x++;
            }
            this.x = 0;
            this.y++;
        }
        this.y = 0;
        this.x = 0;
        
        return true;
    },

    rebuildParkBoundaryFence()
    {
        if (!this.parkFenceIsDirty)
        {
            return true;
        }
        // SurfaceElement.parkFences is a bitmask for which sides to put the fence on.
        // These live on the tiles OUTSIDE the park bounds.
        // the coord+1 tile is the tile that is in the park
        // Y and Y+1: 1
        // X and X+1: 2
        // Y and Y-1: 4
        // X and X-1: 8
        this.squaresLeft = SquaresPerTick;
        // These offsets are backwards because they are relative to the tile that's inside the park
        // whereas the observations above are compared to the tile outside
        const offsetList = [{y:-1, x:0}, {x:-1, y:0}, {y:1, x:0}, {x:1, y:0}];
        while (this.y < map.size.y)
        {
            while (this.x < map.size.x)
            {
                let thisTile = getTileSurfaceElement(map.getTile(this.x, this.y));
                this.squaresLeft--;
                if (thisTile !== undefined && (thisTile.ownership & OWNERSHIP_OWNED) > 0)
                {
                    let offsetIndex = 0;
                    while (offsetIndex < 4)
                    {
                        let offset = offsetList[offsetIndex];
                        let x2 = this.x + offset.x;
                        let y2 = this.y + offset.y;
                        if (x2 > 0 && x2 < map.size.x && y2 > 0 && y2 < map.size.y)
                        {
                            this.squaresLeft--;
                            let compareTile = getTileSurfaceElement(map.getTile(x2, y2));
                            if (compareTile !== undefined && (compareTile.ownership & OWNERSHIP_OWNED) == 0)
                            {
                                compareTile.parkFences |= 1 << offsetIndex;
                            }
                        }
                        offsetIndex++;
                    }
                }
                if (this.squaresLeft <= 0)
                {
                    return false;
                }
                this.x++;
            }
            this.x = 0;
            this.y++;
        }

        // Park entrance tiles should not have park fences on
        // (else a park fence "blocks" your entrance and it looks silly)
        for (const coords of this.containsParkEntrance)
        {
            let tile = getTileSurfaceElement(map.getTile(coords.x, coords.y));
            if (tile !== undefined)
            {
                tile.parkFences = 0;
            }
        }

        
        return true;
    },

    getProgress()
    {
        let proportion = 0;
        if (this.totalRequestedTiles > 0)
        {
            let tilesAssigned = this.totalRequestedTiles - (ScenarioSettings.numOwnedTilesToBuyable + ScenarioSettings.numUnownedTilesToPurchasable + ScenarioSettings.numOwnableTilesToMakeUnbuyable);
            proportion = tilesAssigned/this.totalRequestedTiles;
        }
        else
        {
            // All the map scanning functions have X as the inner loop and Y as the outer
            // If that isn't kept then this will make reported progress jump all over the place erratically
            let numTilesChecked = this.x + (this.y * map.size.x);
            proportion = numTilesChecked/(map.size.x * map.size.y);
        }  
        return (proportion*100).toFixed(1) + "%";
    },
}
