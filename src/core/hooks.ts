// Manage gameplay hooks (event.subscribe...)
// The hook used to spread the randomisation load over multiple ticks is NOT handled here, see randomisermain.ts
// This is for all the stuff that affects routine gameplay rather than the one-off randomisation process

import { StringTable } from "../util/strings";
import { getParkStorageKey } from "./parkstorage"

const IntensityPreferencesNeutral = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const IntensityPreferencesLow = [1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 5];
const IntensityPreferencesHigh = [6, 7, 7, 8, 8, 8, 9, 9, 9];

function guestNarrowIntensityHook()
{
    // Probably want to get through all guests every ~30s, which means checking 1/128 every ~9 ticks
    // Obviously as the array changes size some are going to get missed, but... does that matter?
    // It's that or taking a copy of it after we finish going through it every time, which sounds worse than missing a few
    if (date.ticksElapsed % 9 == 0)
    {
        let offset = (date.ticksElapsed / 9) % 128;
        let guests = map.getAllEntities("guest");
        let choiceArray = IntensityPreferencesNeutral;
        if (park.getFlag("preferMoreIntenseRides") && !park.getFlag("preferLessIntenseRides"))
        {
            choiceArray = IntensityPreferencesHigh;
        }
        else if (park.getFlag("preferLessIntenseRides") && !park.getFlag("preferMoreIntenseRides"))
        {
            choiceArray = IntensityPreferencesLow;
        }
        let arrLength = choiceArray.length;
        while (offset < guests.length)
        {
            let guest = guests[offset];
            if (guest.id != null)
            {
                let picked = choiceArray[guest.id % arrLength];
                guest.minIntensity = picked;
                guest.maxIntensity = picked;
                offset += 128;
            }
        }
    }
}

function guestUmbrellaChanceHook(evt: GuestGenerationArgs)
{  
    if (context.getRandom(0, 100) < getParkStorageKey("GuestUmbrellaChance", 0))
    {
        let guest = map.getEntity(evt.id) as Guest;
        guest.giveItem({type:"umbrella"});
        guest.umbrellaColour = context.getRandom(0, 54); // I THINK there are 54 colours currently, not including invisible/void
    }
}

function guestInitialCashHook(evt: GuestGenerationArgs)
{  
    let savedvalue = getParkStorageKey("GuestInitialCash", 50);
    let newValue = savedvalue + (context.getRandom(0, 4) - 1) * 100;
    let guest = map.getEntity(evt.id) as Guest;
    guest.cash = newValue;
}

function applyInterestModificationHook()
{
    let interestMod = getParkStorageKey("LoanInterestModification", 0);
    if (interestMod != 0)
    {
        let sign = interestMod > 0 ? 1 : -1;
        let absInterestMod = Math.abs(interestMod);
        context.registerAction("ConfigurableObjectiveSetterLoanInterest", (_) => { return {}}, (_) => {
            // This bitshift goes very wrong with a negative interest modifier!
            let weeklyInterest = sign * ((park.bankLoan * 5 * absInterestMod) >>> 14);
            return {cost: weeklyInterest, expenditureType: "interest"};
        })

        context.subscribe("interval.tick", () => {
            if (date.monthProgress % 16384 == 0)
            {
                context.executeAction("ConfigurableObjectiveSetterLoanInterest", {});
            }
        });
    } 
}

var objectiveDeadlineHookHandle: undefined | IDisposable = undefined;

function objectiveDeadlineHook()
{
    if (scenario.status == "failed" || scenario.status == "completed")
    {
        objectiveDeadlineHookHandle?.dispose();
    }
    else if (date.year > getParkStorageKey("ScenarioLength", 1))
    {
        objectiveDeadlineHookHandle?.dispose();
        scenario.status = "failed";
        park.postMessage(StringTable.OBJECTIVE_FAILED_MESSAGE);
    }
}

export function loadGameplayHooks()
{
    if (getParkStorageKey("GuestNarrowIntensity", false)) { context.subscribe("interval.tick", guestNarrowIntensityHook); }
    if (getParkStorageKey("GuestUmbrellaChance", 0) > 0 ) { context.subscribe("guest.generation", guestUmbrellaChanceHook); }
    if (getParkStorageKey("GuestInitialCash", park.guestInitialCash) != park.guestInitialCash ) { context.subscribe("guest.generation", guestInitialCashHook); }
    if (scenario.status == "inProgress") { objectiveDeadlineHookHandle = context.subscribe("interval.day", objectiveDeadlineHook); }
    applyInterestModificationHook();
    console.log("Configurable Objective Setter: loaded gameplay hooks");
}