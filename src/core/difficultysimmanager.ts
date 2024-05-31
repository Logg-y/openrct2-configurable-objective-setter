import { DifficultySim, initialStateDifficultySim } from "./difficultysim";
import { MapAnalysis } from "./maptiles";
import { FinancialPressure, ScenarioSettings, FinancialPressureParams, FinancialPressureSettings } from "./scenariosettings";
import { getConfigOption } from "./sharedstorage";
import { ActiveLogTypes, log } from "../util/logging";

export var FinalActivityLog: string[] = [];

// TODO: setting-ify these

// How many tiles of land the sim needs to be wanting to buy for changing land costs to be worthwhile
const LandCostMinTilesBoughtForAdjustment = 100;

// The number of states we want to try to examine to find the settings closest to what was asked for.
//const FineAdjustTargetNumberStates = 5000;

/*

# The simulation

This uses a simple-ish simulation (see: difficultysim.ts) to "play" through trial settings a LOT of times to try to come up with something close to what was asked for.
This simulation has two "strategies": guest count and profit. I make the assumption that you always want to start with profit and switch to pure guest count
at some point in the scenario. (This might not necessarily be true, eg in cases when the cash machine can be researched part way through)

Given a scenario objective and conditions, it can then "play" and experiment with the strategy switch point until it ends up with the most cash/guests
(objective dependent) at the end of the allotted time limit.

The costs and various parameters of most things in the simulation are fully configurable.

# Difficulty and the challenges of trying to create it

This file deals with trying to make the scenario harder by messing with things that affect the economy of the park.
(We measure this by looking at the smallest amount of cash the optimal simulation has available in its runthrough of the park)
This turns out to be horrifically complicated, for reasons such as:

1) Increasing the cost of something may or may not actually matter. Examples of this include:
    - Making land expensive is pointless if the sim never needs to buy land
    - Making loan interest sky high does very little if the sim pays it back nearly instantly
    - Reducing guest starting cash does nothing meaningful to affect the economy of a pay-per-ride park if the cash machine is available
2) Increasing the cost of something might actually INCREASE that smallest amount of cash on hand.
    - I assume this is down to the strategy switch point being moved around. This will result in less total cash/guests at the end, but doesn't actually make the scenario
      financially "tighter".
3) The number of combinations of variables is extraordinarily large. Combined with the unfortunate fact of 2), this makes narrowing the search space really hard.

# Approach

1) We crank up the financial pressures that we are allowed to really high to try to make some kind of "hard but still completeable" scenario.
   I called this the "coarse" adjustment.
2) We churn through tons and tons of combinations somewhere around that level in the hopes of finding something that is close enough to what the user asked for.
   I called this the "fine" adjustment.

The sim manager uses three classes to try to do this:

1) OptimalStrategyFinder - This makes and cycles DifficultySim objects to find that optimal switch point given some settings.
2) FineAdjustSettingsContainer - This holds all the states the fine adjustment might want to visit and eliminates them where possible.
3) DifficultyAdjuster - The main manager, that manages the other two.

*/

// type to handle the various states of simulation intermediate calls
// This type holds all four of the possible responses, but not every internal function will use all of them
export const enum SimulationStatusReport
{
    OK=1,
    WAITING=2,
    COMPLETE=3,
    IMPOSSIBLE=4,
}

// Either the amount of cash left over from this sim run, or undefined if it failed
type SimulationResult = SimulationStatusReport.IMPOSSIBLE | DifficultySim;

// Class that tries to find the optimal month to switch between profit/guest generation for the current ScenarioSettings
// to get as many guests or profit (objective dependent) as is possible in the scenario's time limit.
class OptimalStrategyFinder
{
    private switchMonthResults: Record<number, SimulationResult> = {};
    private incompleteSimulations: Record<number, DifficultySim> = {};
    startPoint = 0;
    trialPoint: undefined | number = undefined;
    optimalSwitchPoint: undefined | number = undefined;

    // How many iterations (simulation month updates) we are allowed to do this call
    // before we should stop and let the main engine loop do its thing
    // Otherwise the game will lock up forever while this is running, which isn't ideal
    iterationsLeft = 0;

    
    // Returns a SimulationResult if the simulation is done, false if more work is needed
    getResult(switchPoint: number): SimulationResult | SimulationStatusReport.WAITING
    {
        if (this.runASimulation(switchPoint) === SimulationStatusReport.COMPLETE)
        {
            return this.switchMonthResults[switchPoint];
        }
        return SimulationStatusReport.WAITING;
    }

    getOptimalResult(): SimulationResult | SimulationStatusReport.IMPOSSIBLE | SimulationStatusReport.WAITING
    {
        let response = this.findOptimalStrategySwitchPoint();
        if (response === SimulationStatusReport.COMPLETE)
        {
            if (this.optimalSwitchPoint !== undefined)
            {
                return this.switchMonthResults[this.optimalSwitchPoint];
            }
            return SimulationStatusReport.IMPOSSIBLE;
        }
        return response;
    }

    
    // Return: true if the simulation completed, false if it needs more work
    runASimulation(switchPoint: number): SimulationStatusReport.COMPLETE | SimulationStatusReport.WAITING
    {
        if (this.switchMonthResults[switchPoint] != undefined)
        {
            return SimulationStatusReport.COMPLETE;
        }
        let sim: DifficultySim;
        if (this.incompleteSimulations[switchPoint] != undefined)
        {
            sim = this.incompleteSimulations[switchPoint];
        }
        else
        {
            sim = initialStateDifficultySim();
            this.incompleteSimulations[switchPoint] = sim;
        }
        let monthsToDo = Math.min(this.iterationsLeft, sim.monthsLeft);
        this.iterationsLeft -= monthsToDo;
        let simIsViable = true;
        while (monthsToDo > 0)
        {
            sim.updateMonth(sim.monthsCompleted < switchPoint ? "profit" : "guestcount");
            if (!sim.isViable())
            {
                simIsViable = false;
                break;
            }
            monthsToDo--;
        }
        if (simIsViable && sim.monthsLeft > 0)
        {
            return SimulationStatusReport.WAITING;
        }
        // This means that it didn't actually finish repaying its loan!
        if (sim.monthsLeft == 0 && ScenarioSettings.objectiveType == "repayLoanAndParkValue" && sim.objectiveMetric > 0)
        {
            simIsViable = false;
        }
        if (!simIsViable)
        {
            this.switchMonthResults[switchPoint] = SimulationStatusReport.IMPOSSIBLE;
        }
        else
        {
            this.switchMonthResults[switchPoint] = sim;
            if (ActiveLogTypes["AllSuccessfulSims"])
            {
                for (const k in sim.activityLog)
                {
                    log(sim.activityLog[k], "AllSuccessfulSims");
                }
            }
        }
        delete this.incompleteSimulations[switchPoint];
        return SimulationStatusReport.COMPLETE;        
    }

    
    // Possible returns:
    // number - the first month to switch strategy from profit to guest generation
    // undefined - scenario is not completable
    // false - more work is needed
    findOptimalStrategySwitchPoint(): SimulationStatusReport.COMPLETE | SimulationStatusReport.IMPOSSIBLE | SimulationStatusReport.WAITING
    {
        if (this.optimalSwitchPoint !== undefined)
        {
            return SimulationStatusReport.COMPLETE
        }

        // this.trialPoint === undefined is not possible in this function
        let trialPoint = this.trialPoint as number;
        // Repay loan is a pure profit endeavour, there is really no point in grinding through these
        if (ScenarioSettings.objectiveType == "repayLoanAndParkValue")
        {
            let result = this.getResult(ScenarioSettings.scenarioLength*8);
            if (result == SimulationStatusReport.IMPOSSIBLE || result == SimulationStatusReport.WAITING)
            {
                return result;
            }
            this.optimalSwitchPoint = ScenarioSettings.scenarioLength*8;
            return SimulationStatusReport.COMPLETE;
        }
        
        // We assume the optimal state is when both switching one before and one after are both either nonviable or give less of whatever quantity we care about.
        while (true)
        {
            log("findOptimalStrategySwitchPoint starts", "SimManagerIterations");
            this.trialPoint = trialPoint;
            let thisPoint = this.getResult(trialPoint);
            
            if (thisPoint === SimulationStatusReport.WAITING) // waiting on sim to finish
            {
                return SimulationStatusReport.WAITING;
            }
            else if (thisPoint !== SimulationStatusReport.IMPOSSIBLE)
            {
                log(`find optimal switch point trying: ${trialPoint}, state = ${thisPoint.objectiveMetric}`, "StrategySwitchPoint");
            }

            // This goes through all the possibilities and finds the best
            /*
            // Try to find a point that is viable
            trialPoint--;
            // Went past the start? go to the end
            if (trialPoint < 0)
            {
                trialPoint = ScenarioSettings.scenarioLength * 8;
            }
            // Back to where we started? This scenario is not completable
            if (trialPoint == this.startPoint)
            {
                let viableValues: Record<number, number> = {};
                for (const k in this.switchMonthResults)
                {
                    let val = this.switchMonthResults[k];
                    if (val !== SimulationStatusReport.IMPOSSIBLE)
                    {
                        viableValues[val.objectiveMetric] = Number(k);
                    }
                }
                let numberKeys = Object.keys(viableValues) as unknown[] as number[];
                let bestMetric = Math.max(...numberKeys);
                this.optimalSwitchPoint = 5;
                return SimulationStatusReport.COMPLETE;
            }
            */

            // This assumes that there will be exactly one turning point and we can stop once we find it
            if (thisPoint === SimulationStatusReport.IMPOSSIBLE)
            {
                // Try to find a point that is viable
                trialPoint--;
                // Went past the start? go to the end
                if (trialPoint < 0)
                {
                    trialPoint = ScenarioSettings.scenarioLength * 8;
                }
                // Back to where we started? This scenario is not completable
                if (trialPoint == this.startPoint)
                {
                    this.trialPoint = undefined;
                    return SimulationStatusReport.IMPOSSIBLE;
                }
                continue;
            }
            else
            {
                let prevPoint: SimulationResult | SimulationStatusReport.WAITING = SimulationStatusReport.IMPOSSIBLE;
                let nextPoint: SimulationResult | SimulationStatusReport.WAITING = SimulationStatusReport.IMPOSSIBLE;
                // Map objectiveMetric: switchpoint
                let viableValues: Record<number, number> = {};
                viableValues[thisPoint.objectiveMetric] = trialPoint;

                if (trialPoint < ScenarioSettings.scenarioLength * 8)
                {
                    nextPoint = this.getResult(trialPoint + 1);
                    if (nextPoint === SimulationStatusReport.WAITING) // waiting on sim to finish
                    {
                        return SimulationStatusReport.WAITING;
                    }
                    else if (nextPoint !== SimulationStatusReport.IMPOSSIBLE)
                    {
                        log(`nextpoint state = ${nextPoint.objectiveMetric}`, "StrategySwitchPoint");
                        viableValues[nextPoint.objectiveMetric] = trialPoint + 1;
                    }
                    
                }
                if (trialPoint > 0)
                {
                    prevPoint = this.getResult(trialPoint - 1);
                    
                    if (prevPoint === SimulationStatusReport.WAITING) // waiting on sim to finish
                    {
                        return SimulationStatusReport.WAITING;
                    }
                    else if (prevPoint !== SimulationStatusReport.IMPOSSIBLE)
                    {
                        log(`prevpoint state = ${prevPoint.objectiveMetric}`, "StrategySwitchPoint");
                        viableValues[prevPoint.objectiveMetric] = trialPoint - 1;
                    }
                }
                let numberKeys = Object.keys(viableValues) as unknown[] as number[];
                let bestMetric = Math.max(...numberKeys);
                if (bestMetric !== thisPoint.objectiveMetric)
                {
                    let newSwitch = viableValues[bestMetric];
                    log(`Best switch point = ${newSwitch}: ${bestMetric} vs ${thisPoint.objectiveMetric}`, "StrategySwitchPoint");
                    trialPoint = newSwitch;
                    continue;
                }
            }
            this.optimalSwitchPoint = trialPoint;
            return SimulationStatusReport.COMPLETE;
        }
    }


}

/*
class FineAdjustSettingsContainer
{
    settingsBeingTested: FinancialPressureSettings = {};
    targetValue = 0;
    bestSettings: undefined | FinancialPressureSettings = undefined;
    bestValue: undefined | number;

    // Organising the possibility space is a challenge, as it becomes a multi dimensional array with a variable amount of dimensions
    // depending on how many financial pressures were asked for!

    // Managing that with type safety sounds awful, because the definition would presumably need to look something like
    //data: number[] | number[][] | number[][][] | number[][][][] | number[][][][][] = [];

    // I don't know if this would actually be any faster, because culling larger amounts of the possibility space then needs doing by hand
    // rather than just a single .filter call every time - which maybe leaves more in the hands of the JS interpreter
    // ... and an implementation that deals with the varying amounts of dimensions without making any mistakes would be a LOT harder than just doing this:
    private data: FinancialPressureSettings[] = [];

    // Get a random setting combination that hasn't been tested yet
    getRandomUntestedSettings(): FinancialPressureSettings
    {
        if (this.data.length % 10 == 0)
        {
            console.log(`Fine adjust settings queue contains ${this.data.length}`);
        }
        let last = this.data.pop();
        this.settingsBeingTested = last ?? {};
        return this.settingsBeingTested;
    }

    
    // Process a SimulationResult generated from the given FinancialPressureSettings.
    // Return true if this is a new best, otherwise false.
    processSettingsResult(result: SimulationResult)
    {
        if (result === SimulationStatusReport.IMPOSSIBLE)
        {
            console.log(`Impossible result: ${JSON.stringify(this.settingsBeingTested)}`);
            // If the sim wasn't possible to complete, we can remove everything more difficult than it
            this.data = this.data.filter((elem: FinancialPressureSettings) =>
                {
                    let k: keyof FinancialPressureSettings;
                    for (k in elem)
                    {
                        let thisTrial = this.settingsBeingTested[k];
                        let other = elem[k];
                        if (thisTrial !== undefined && other !== undefined)
                        {
                            let stepDirection = FinancialPressureParams[k].step;
                            if ((stepDirection > 0 && thisTrial > other) || (stepDirection < 0 && thisTrial < other))
                            {
                                return true;
                            }
                        }
                    }
                    return false;
                }
            )
            return false;
        }
        else
        {
            let thisDiff = 0;
            let bestDiff = 1;
            if (this.bestValue !== undefined)
            {
                bestDiff = Math.abs(this.targetValue - this.bestValue);
                thisDiff = Math.abs(this.targetValue - result.lowestCashAvailable);
            }
            if (bestDiff > thisDiff)
            {
                this.bestValue = result.lowestCashAvailable;
                this.bestSettings = this.settingsBeingTested;
                console.log(`New best settings: ${JSON.stringify(this.bestSettings)}`);
                return true;
            }
            console.log(`Discard settings: ${JSON.stringify(this.settingsBeingTested)} (${result.lowestCashAvailable} vs ${this.bestValue}), diffs ${thisDiff} vs ${bestDiff}`);
        }
        
        return false;
    }

    constructor(targetValue: number, bestSettings: typeof ScenarioSettings)
    {
        this.targetValue = targetValue;
        let numFinancialPressures = bestSettings.financialPressures.length;
        if (numFinancialPressures > 0)
        {
            let statesPerPressure = Math.round(Math.pow(FineAdjustTargetNumberStates, (1/numFinancialPressures)));
            console.log(`Fine adjust: ${numFinancialPressures} dimensions with ${statesPerPressure} values each`);

            let pressureStages: {pressure:FinancialPressure,start:number, num:number, step:number}[] = [];
            
            for (let index in bestSettings.financialPressures)
            {
                let pressure = bestSettings.financialPressures[index];
                let val = bestSettings.getValueFromFinancialPressure(pressure);
                let params = FinancialPressureParams[pressure];
                let stepsToMax = 50;
                if (params.max !== undefined)
                {
                    stepsToMax = Math.abs((val - params.max)/FinancialPressureParams[pressure].step);
                }
                let step = Math.max(1, Math.floor(stepsToMax/statesPerPressure));
                pressureStages.push({start:val, num:statesPerPressure, pressure:pressure, step:step});
            }
            let a = function recursiveArrayBuilder(states: {pressure:FinancialPressure,start:number,num:number,step:number}[])
            {
                let thisIterationOutput: FinancialPressureSettings[] = [];
                let thisIteration = states.pop();
                if (thisIteration !== undefined)
                {
                    let val = thisIteration.start;
                    let params = FinancialPressureParams[thisIteration.pressure];
                    let step = params.step * thisIteration.step;
                    let diff = 0;
                    let iteration = 0;
                    let lastAddedIteration = 0;
                    while (thisIteration.num > 0)
                    {
                        let newVal = val + (diff * (iteration % 2 == 0 ? 1 : -1));
                        if ((params.max === undefined || newVal <= params.max) && (params.min === undefined || newVal >= params.min))
                        {
                            thisIterationOutput.push({[thisIteration.pressure]: newVal});
                            lastAddedIteration = iteration;
                            thisIteration.num--;
                        }
                        
                        if (iteration % 2 == 0)
                        {
                            diff += step;
                        }
                        iteration++;
                        if (iteration - lastAddedIteration > 3)
                        {
                            break;
                        }
                    }
                    if (states.length > 0)
                    {
                        let recursiveOutput = recursiveArrayBuilder(states);
                        let combinedOutput: FinancialPressureSettings[] = [];
                        for (const outputIndex in recursiveOutput)
                        {
                            let outputItem = recursiveOutput[outputIndex];
                            for (const newIndex in thisIterationOutput)
                            {
                                let newItem = thisIterationOutput[newIndex]
                                combinedOutput.push({...newItem, ...outputItem});
                            }
                        }
                        return combinedOutput;
                    }
                }
                return thisIterationOutput;
            }
            this.data = a(pressureStages);

            // Shuffle the settings order
            let currentIndex = this.data.length;
            while (currentIndex > 0) 
            {
                let randomIndex = context.getRandom(0, currentIndex);
                currentIndex--;
                [this.data[currentIndex], this.data[randomIndex]] = [this.data[randomIndex], this.data[currentIndex]];
            }

            console.log(`Initial fine adjust settings queue contains ${this.data.length} items`);
            
        }
    }
}
*/

type DifficultyAdjusterModes = "coarse" | "fine";

export class DifficultyAdjuster
{
    bestSimulation: DifficultySim | undefined = undefined;
    tightestFinancial: number | undefined = undefined;

    private lastDifficultyAdjustment = 10;
    private lastFinancialPressure: FinancialPressure | undefined = undefined;
    private unadjustableFinancialPressures : FinancialPressure[] = [];
    private adjustmentStep = 128;

    canAlterStartingCash = false;

    strategyFinder = new OptimalStrategyFinder;

    mode: DifficultyAdjusterModes = "coarse";
    //private fineAdjustSettings: FineAdjustSettingsContainer | undefined = undefined;
    finalSettings: FinancialPressureSettings = {};
    
    // Coarse difficulty adjustment:
    // The fine adjustment would give some result, but picking randomly and doing small adjustments tends to increase all the pressures evenly.
    // I think it's quite nice to have them a bit lopsided, as it introduces a bit more variety
    //  1) Pick (large) number of steps
    //  2) Try a factor in turn, if it fails then revert, if it succeeds then keep it
    //  3) Pick a different factor (even if 2) succeeded) and repeat until all make it too difficult or are at max value
    //  4) Half number of steps, repeat until step count is small enough

    // Fine difficulty adjustment:
    // First, find some settings where the scenario can be completed, by making whatever pressures we generated lighter
    // Then try to find some rough settings that are about okay by:
        // 1) Pick factor to adjust
        // 2) Give it a move towards the target
        // 3) If too far, do less and less until it gets there or we conclude that this factor is already at its limit
        // 4) If not far enough, go back to 1)

    // Turns out that these are similar enough that they can be very easily bundled together in the same function

    // Return complete if the settings are good, or ok if we want to do more with them
    // or impossible if we can't get anything that works 
    handleSimResult(result: SimulationResult): SimulationStatusReport
    {
        let resultIsOkay = result !== SimulationStatusReport.IMPOSSIBLE;
        if (result !== SimulationStatusReport.IMPOSSIBLE)
        {
            // If below the desired average cash AND worse than the previous closest, this is also bad
            let isNewBest = false;
            if (this.tightestFinancial === undefined)
            {
                isNewBest = true;
            }
            else
            {
                let bestDiff = Math.abs(this.tightestFinancial - getConfigOption("CashTightness"));
                let thisDiff = Math.abs(result.averageEndMonthCash - getConfigOption("CashTightness"));
                console.log(`This iteration's difference ${thisDiff} vs best known ${bestDiff} ${thisDiff < bestDiff ? "- NEW BEST" : ""})`);
                // Debating whether to allow lower - for consistent user difficulty it's probably best not to
                if (thisDiff < bestDiff && result.averageEndMonthCash >= getConfigOption("CashTightness"))
                {
                    isNewBest = true;
                }
                else if (result.averageEndMonthCash < getConfigOption("CashTightness"))
                {
                    resultIsOkay = false;
                }
            }
            if (isNewBest)
            {
                this.tightestFinancial = result.averageEndMonthCash;
                this.bestSimulation = result;
                this.finalSettings = ScenarioSettings.getFinancialPressureSettings();
            }
        }
        if (resultIsOkay)
        {
            console.log("handleSimResult: increase was okay");
            this.unadjustableFinancialPressures = [];
            if (this.mode == "fine")
            {
                this.adjustmentStep = 16;
            }
        }

        if (this.tightestFinancial === undefined && !resultIsOkay)
        {
            console.log("handleSimResult: impossible result with no saved viable sim");
            this.canAlterStartingCash = true;
            // Try to make things easier until we get some state that works
            if (this.adjustSettingsForDifficulty(-10, undefined) == SimulationStatusReport.OK)
            {
                this.canAlterStartingCash = false;
                return SimulationStatusReport.OK;
            }   
            // Can't redure more pressure? This scenario is unplayable
            return SimulationStatusReport.IMPOSSIBLE;
        }

        if (!resultIsOkay && this.lastFinancialPressure !== undefined)
        {
            ScenarioSettings.adjustSettingsForFinancialPressure(this.lastFinancialPressure, -1*this.lastDifficultyAdjustment, "add");
            console.log(`handleSimResult: increase went too far, undoing: ${this.lastFinancialPressure} = ${ScenarioSettings.getValueFromFinancialPressure(this.lastFinancialPressure)}`);
            this.unadjustableFinancialPressures.push(this.lastFinancialPressure);
        }

        while (true)
        {
            if (this.adjustSettingsForDifficulty(this.adjustmentStep, undefined) === SimulationStatusReport.OK)
            {
                return SimulationStatusReport.OK;
            }

            if (this.adjustmentStep > 64 && this.mode == "coarse")
            {
                this.adjustmentStep = Math.max(1, Math.floor(this.adjustmentStep/2));
                this.unadjustableFinancialPressures = [];
            }
            else if (this.adjustmentStep > 1 && this.mode == "fine")
            {
                this.adjustmentStep = Math.max(1, Math.floor(this.adjustmentStep/2));
                this.unadjustableFinancialPressures = [];
            }
            else
            {
                return SimulationStatusReport.COMPLETE;
            }
        }
    }

    // Return the actual amount of steps that a given pressure can be modified by, if any.
    // The amount passed is the amount we'd like to move it, this decides whether we can and if so by how much
    canAdjustPressure(pressure: FinancialPressure, amount: number): number
    {
        // If we've already tried and eliminated this pressure then we've exhausted its possibilities and so there's no point in
        // doing anything else with it right now
        if (this.unadjustableFinancialPressures.indexOf(pressure) > -1)
        {
            return 0;
        }
        let params = FinancialPressureParams[pressure];

        if (pressure == "initialcash")
        {
            // For now we keep a tighter grip on starting cash and so only increase it if the scenario is unwinnable
            // could maybe change this in the future though
            if (amount > 0)
            {
                return 0;
            }
        }
        else if (pressure == "landcost")
        {
            // If the sim doesn't want to buy much/any land changing this won't do a whole lot
            if (this.bestSimulation === undefined || this.bestSimulation.totalLandBought < LandCostMinTilesBoughtForAdjustment)
            {
                return 0;
            }
        }

        let current = ScenarioSettings.getValueFromFinancialPressure(pressure);
        let proposed = current + amount * params.step;
        //console.log(`Consider adjusting pressure ${pressure}: current ${current}, proposed ${proposed} (${amount} steps of ${params.step}), allowed=${params.min}-${params.max}`);
        if (params.max !== undefined && proposed > params.max)
        {
            let maxDelta = params.max - current;
            let stepsForMax = Math.floor(maxDelta/Math.abs(params.step));
            //console.log(`maxdelta ${maxDelta}, stepsformax ${stepsForMax}`);
            return stepsForMax * (amount >= 0 ? 1 : -1);
        }
        if (params.min !== undefined && proposed < params.min)
        {
            let minDelta = current - params.min;
            let stepsForMin = Math.floor(minDelta/Math.abs(params.step));
            //console.log(`minDelta ${minDelta}, stepsForMin ${stepsForMin}`);
            return stepsForMin * (amount >= 0 ? 1 : -1);
        }
        return amount;
    }


    // Return: true if we managed to adjust settings, false if we can't
    adjustSettingsForDifficulty(amount: number, financialPressure: FinancialPressure | undefined): SimulationStatusReport.OK | SimulationStatusReport.IMPOSSIBLE
    {
        this.lastDifficultyAdjustment = amount;
        if (financialPressure === undefined)
        {
            let possiblePressures: FinancialPressure[] = [];
            for (let pressureKey in ScenarioSettings.financialPressures)
            {
                let pressure = ScenarioSettings.financialPressures[pressureKey];
                if (this.unadjustableFinancialPressures.indexOf(pressure) <= -1 && this.canAdjustPressure(pressure, amount) != 0)
                {
                    possiblePressures.push(pressure);
                }
            }
            // If desperate we allow increasing initial cash
            if (possiblePressures.length == 0 && this.canAdjustPressure("initialcash", amount) != 0 && this.bestSimulation === undefined)
            {
                possiblePressures.push("initialcash");
            }
            if (possiblePressures.length == 0)
            {
                console.log("No possible pressures, can't increase further");
                return SimulationStatusReport.IMPOSSIBLE;
            }
            financialPressure = possiblePressures[context.getRandom(0, possiblePressures.length)];
        }
        let actualAmount = this.canAdjustPressure(financialPressure, amount) * FinancialPressureParams[financialPressure].step;
        if (actualAmount == 0)
        {
            return SimulationStatusReport.IMPOSSIBLE;
        }
        ScenarioSettings.adjustSettingsForFinancialPressure(financialPressure, actualAmount, "add");
        console.log("Adjust pressure " + financialPressure + " by " + actualAmount + ", now " + ScenarioSettings.getValueFromFinancialPressure(financialPressure));
        this.lastDifficultyAdjustment = actualAmount;
        this.lastFinancialPressure = financialPressure;
        return SimulationStatusReport.OK;
    }
 
    update(): SimulationStatusReport
    {   
        this.strategyFinder.iterationsLeft = getConfigOption("SimMonthsPerTick");
        
        while (true)
        {
            log("update starts", "SimManagerIterations");
            if (this.strategyFinder.trialPoint === undefined)
            {
                let oldIterations = this.strategyFinder.iterationsLeft;
                this.strategyFinder = new OptimalStrategyFinder;
                this.strategyFinder.iterationsLeft = oldIterations;
                // We are going to run a bunch of simulations and change the strategy switch point (from cash to guests) and see how good we can get
                // For the sake of an arbitrary start point, how about half way through the scenario
                this.strategyFinder.startPoint = Math.floor(8*ScenarioSettings.scenarioLength/2);
                this.strategyFinder.trialPoint = this.strategyFinder.startPoint;  
            }            
            let result = this.strategyFinder.getOptimalResult();
            if (result === SimulationStatusReport.WAITING) // more calls needed
            {
                return result;
            }

            let handledResult = this.handleSimResult(result);

            if (handledResult === SimulationStatusReport.WAITING || handledResult === SimulationStatusReport.IMPOSSIBLE) // more calls needed or scenario impossible
            {
                return handledResult;
            }
            if (handledResult === SimulationStatusReport.COMPLETE)
            {
                if (this.mode == "coarse")
                {
                    this.mode = "fine"
                    this.unadjustableFinancialPressures = [];
                    //this.fineAdjustSettings = new FineAdjustSettingsContainer(getConfigOption("CashTightness"), ScenarioSettings);
                    //ScenarioSettings.loadFinancialPressureSettings(this.fineAdjustSettings.getRandomUntestedSettings());
                }
                else
                {
                    if (this.bestSimulation !== undefined)
                    {
                        for (const k in this.bestSimulation.activityLog)
                        {
                            console.log(this.bestSimulation.activityLog[k]);
                        }
                        console.log(`Best sim average cash on hand: ${this.bestSimulation.averageEndMonthCash}`);
                        // This is the best place to pull anything out of the final simulation that we might want to keep
                        FinalActivityLog = this.bestSimulation.activityLog;
                        let unownedToOwnedTilesNeeded = this.bestSimulation.totalLandBought - (MapAnalysis.buyableLand + MapAnalysis.buyableRights + ScenarioSettings.numOwnedTilesToBuyable);
                        if (unownedToOwnedTilesNeeded > 0)
                        {
                            ScenarioSettings.numUnownedTilesToPurchasable = unownedToOwnedTilesNeeded;
                        }
                        if (getConfigOption("ShrinkSpace"))
                        {
                            let excessTiles = (park.parkSize + MapAnalysis.buyableLand + MapAnalysis.buyableRights) - this.bestSimulation.totalLandUsage;
                            console.log(`Initial state contains ${park.parkSize + MapAnalysis.buyableLand + MapAnalysis.buyableRights} playable tiles`);
                            console.log(`Sim apparently uses ${this.bestSimulation.totalLandUsage}, so ${excessTiles} need removing`)
                            if (excessTiles > 0)
                            {
                                ScenarioSettings.numOwnableTilesToMakeUnbuyable = Math.floor(excessTiles);
                            }
                        }
                        if (ScenarioSettings.objectiveType == "guestsAndRating")
                        {
                            ScenarioSettings.objectiveQuantity = 50*Math.floor(this.bestSimulation.guestsInPark/50);
                        }
                        else if (ScenarioSettings.objectiveType == "repayLoanAndParkValue")
                        {
                            // TODO
                        }
                    }                    
                    return SimulationStatusReport.COMPLETE;
                }
            }
            
            if (handledResult === SimulationStatusReport.OK) 
            {
                this.strategyFinder.trialPoint = undefined;
            }
            
        }
    }
}

/*
Unimplemented:

Weight the pressures randomly for variance rather than relying on coarse to do it. For repay loan, the initialdebt is going tohave to be high.

UI: rando in progress
UI: scenario in progress

Financial starts
Financial pressures

Umbrella start
Narrow intensity preferences
Guest start cash
Additional forced interest
Time limits

Objectives window
*/