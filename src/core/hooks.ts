// Manage gameplay hooks (event.subscribe...)
// The hook used to spread the randomisation load over multiple ticks is NOT handled here, see randomisermain.ts
// This is for all the stuff that affects routine gameplay rather than the one-off randomisation process

import { getParkStorageKey } from "./parkstorage"

function guestNarrowIntensityHook()
{
    // Probably want to get through all guests every ~30s, which means checking 1/128 every ~9 ticks
    // Obviously as the array changes size some are going to get missed, but... does that matter?
    if (date.ticksElapsed % 9 == 0)
    {
        let offset = (date.ticksElapsed / 9) % 128;
        let guests = map.getAllEntities("guest");
        while (offset < guests.length)
        {
            let guest = guests[offset];
            let range = Math.min(9, guest.maxIntensity) - guest.minIntensity;
            let picked = guest.minIntensity + context.getRandom(0, range+1);
            guest.minIntensity = picked;
            guest.maxIntensity = picked;
            offset += 128;
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
        // @ts-ignore action parameters expect callbacks that accept one param that I don't need, and TS complains they are unused
        context.registerAction("ConfigurableObjectiveSetterLoanInterest", (args) => { return {}}, (args) => {
            let weeklyInterest = (park.bankLoan * 5 * interestMod) >>> 14;
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

export function loadGameplayHooks()
{
    if (getParkStorageKey("GuestNarrowIntensity", false)) { context.subscribe("interval.tick", guestNarrowIntensityHook); }
    if (getParkStorageKey("GuestUmbrellaChance", 0) > 0 ) { context.subscribe("guest.generation", guestUmbrellaChanceHook); }
    if (getParkStorageKey("GuestInitialCash", park.guestInitialCash) != park.guestInitialCash ) { context.subscribe("guest.generation", guestInitialCashHook); }
    applyInterestModificationHook();
    console.log("Configurable Objective Setter: loaded gameplay hooks");
}