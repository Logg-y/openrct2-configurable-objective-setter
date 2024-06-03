# "Normal" parks vs game mechanics abuse

I'm going for making "normal" parks. Game mechanic abuse plays (eg: spamming many copies of the same efficient ride, ride distraction approaches, locking all your guests in endless queues so they can't leave...) are obviously the most efficient way to play the game, but at the end of the day the result of this looks nothing like a "normal" theme park. And given that these optimised strategies generally all go the same way and are abusing the same few principles, making any kind of randomiser with their use in mind is somewhat pointless because no matter what objectives you set, the optimal mechanic abuse strategy is going to be doing more or less the same thing anyway.

It makes way more sense to me to design around what sort of things a "normal" park will do, rather than one where all the guests are locked to one tile of path or a huge queue for a free transport ride that doesn't go anywhere, or where all the rides are an identical design.

That said, you can probably adjust the parameters of this thing to cater to that if you really wanted to.

# Difficulty

Obviously one or more difficulty sliders seems like a good idea. But to really capture that, what can actually make RCT difficult?

- Guest count vs time. There's going to be a theoretical max amount of guests per year, IE constant advertising (if available) and keeping soft guest cap higher than the current guest count.
- Finances. A scenario with eg a very high loan payback every month can end in unrecoverable debt if time/money is not spent efficiently.

The two can also be linked, eg no cash machine and pay-for-entry means that your only income is new guests entering. There is then financial incentive to get guests out the park as fast as possible, but taking steps to make them want to leave makes climbing the guest goal harder.

Of the two, the financial pressure seems more interesting to me: for pure guest problems, the answer is "build stuff" and so long as you can afford it and you build it fast enough to outpace your soft guest cap, the only other thing that really matters is controlling guest retention.

## Quantifying sliders

At first take, I am inclined to think of sliders as "what percentage of the possible guests/money do you need to beat the scenario", which is probably a good starting point, but the calculations are hard.

Both the theoretical maximum number of guests and money can be calculated. For guests, it's easy: just add base generation and advertising together (unless it's turned off). For finances, it depends on whether the cash machine is available: if not, then the available money is simply average cash per guest multiplied by the maximum number of guests. If it is _and_ you can charge for rides, it should be a matter of adding some integral of the ideal linear guest growth graph that describes how fast you can get guests to withdraw cash and then spend it over and over.

If you can only charge for rides and harder guest generation is on, you might not be able to afford to continuously build more rides to keep the soft guest counter ahead (with the train holding push strat to artifically lengthen rides this isn't an issue, but that's yet more mechanics abuse). Or if you have to buy land for new rides, life suddenly gets a bit more interesting and the calculations start to suck a lot, because you'll need some guests to want to go home too so that you can get more park entry revenue.

In a scenario with no cash machine it's also very possible to part guests from their cash so efficiently that they leave as fast as new guests arrive, even though you're well below the soft guest cap, especially if advertising is forbidden.

Smaller parks also have an upper bound in the form of available building space that at some point you will probably reach. Or you hit the entity limit first if the park is big enough.

### Inducing financial pressure

There's a few ways to do this:
- Loans and interest. Do you repay loan or do you spend on your park? Decisions decisions. Or maybe you start with a gigantic loan and get bodied by interest all game instead, but this is less interesting as it takes away the choice of whether to repay or not.
- Making land buyable. It looks like plugins can change the buyable-ness of land.
- Dramatically increasing the cost of researching new items. How much do you want those new objects?
- Dramatically increasing the cost of staff. How few can you get away with?
- Dramatically increasing ride running costs. But this sort of sucks because to make any dent on most coasters you'd need something over 20x, while a car ride at base running costs is already not really profitable.
- Reducing the amount of cash carried per guest, which will likely have a big impact on how fast you can get more guests coming in.

# Vanilla objective scrutiny

Some of the lesser used vanilla objectives are really asking to be gamed in a way that is (at least to me) quite unfun.
- Park value goals. These are very easily cheesed by making some cheap coaster with lethal G forces which contributes tons to park value for some reason.
- Monthly ride/stall profits: Given these are only for one month, it is possible to try to set yourself up for an unsustainable push at these. Also for the stall version, overpriced umbrellas really trivialise the amount of profit you can get out of other stalls.

Maybe one could argue that the mechanics abuse vs "normal" park argument should apply to these, but if you _aren't_ trying to game these then I don't know that they change decision making in any interesting way versus simply trying to get as many guests as possible anyway. More guests makes monthly sales possible, and more guests means more money to throw into your park.

Additionally, the following cannot be failed:
- Guests with rating above 700, once your rating stabilises high enough
- Monthly ride/stall profits
- Repay loan and park value

I am conceptually somewhat against these goals which cannot feasibly be failed. It does really defeat the point having difficulty settings at all, unless you made the failure case inescapable debt incurred by loan interest or something. But then the other goals can also get that.

## Novel plugin possibilities

The plugin interface means new things can be done...

Setting the objective to "guestsAndRating" with guests=0 completes on the next game day providing there's 700 rating. Permanent failure can be done by setting this objective, setting status to failed and closing the park - then it can't be reopened.

### New objectives

These can be communicated by providing a plugin window for park objectives and using "Have fun" until the conditions are met. But I don't even know what here is actually interesting enough and practical enough to do besides setting a coaster building challenge with a deadline - and that is one probably best left for the track designer.

### New failure conditions

These can be used to force a time limit on things, eg:
- X weeks with cash in the red
- Forced failure after X date, even for objectives that can't normally be failed

### New scenario conditions

These have a lot more flexibility, eg:
- All guests spawn with umbrellas, now you can't get cash this way
- Guests' intensity preferences narrow really hard really fast (becomes limit ± happiness)
- Guest happiness/energy drains faster than normal
- All guests have nausea tolerance none (should limit to 3.0 + happiness)
- Artificial limitations against too many of one ride type, but is there really any point in doing this
- Extra requirements, eg you must build one coaster with >9 excitement per year or you start getting fined

# Randomisation logic

It seems to me that randomisation should go something like this:
- User picks preferences
	- What kind of scenario restrictions they want and how likely they are to happen
	- How long they want the scenario to run for
	- Difficulty sliders: guests and financial
	- Allowed objective types and odds of each
	- Pay per ride vs pay for entry
	- Financial pressures: what things we can do to make the scenario harder, eg make people have to buy land, heavy loan, reducing starting guest cash...
- Pick scenario conditions (harder guest generation, banned advertising, tree removal, terrain modification...) according to preferences
- Simulation loop: we know their slider settings, figure out how many guests and how much income those slider settings will produce
	- Now figure out a way to up the financial load to hit the desired amount on the slider, this is probably an iterative process

Suppose someone has both guests and financial sliders at 50%. I would take this to mean "to beat the scenario you need guest generation at 50% of the theoretical calculated maximum and to spend 50% of the cash you get from this on a reasonably normal park composition."

- Maximum guest generation over the course of the scenario, discounting awards - max natural guest generation plus max advertising if available
- Maximum income:
	- Pay for entry: this is simply minimum starting cash times max guest generation minus advertising expenses.
	- Pay for rides: this isn't any different until the cash machine gets involved, in which case it gets complicated.
	- In both cases but especially pay per ride, the cash machine is an added complication, because the amount of cash being put in guests' pockets across the map is no longer governed solely by guest generation, instead it's also dependent on how many guests you can maintain in your park. And that is probably a difficult calculation to guess at. But for guest goals we sort of need to be able to get this anyway.

There are caveats to this. In a fresh park, you can't charge max entry, or maybe you start with too little cash to advertise. The way to go is probably a month by month simulator of projected guests/finances and adjust things until we come close to the targets the sliders asked for.

# Options

- Main tab
	- Guest difficulty percentage
	- Financial difficulty percentage
	- Scenario length
	- Pay per ride % chance
- Objectives and Restrictions
	- Objective weight: Guests/Date
	- Objective weight: Repay loan by date
	- Harder guest generation % chance
	- Harder park rating % chance
	- Forbid high building % chance
	- Forbid tree removal % chance
	- Forbid advertising % chance
	- Forbid land alteration % chance
- Land settings
	- Max density (soft guest cap per tile) given no restrictions
	- Allow buying normally unavailable land to increase max park size if density demands it
- Financial settings
	- Start position weights
		- No debt (vanilla like)
		- Moderate debt (plus high interest, you will want to repay this)
		- Severe debt (forced by repay loan objective type)
	- Difficulty methods
		- Min methods used per scenario
		- Target max methods used per scenario (can exceed this if required to reach required difficulty)
		- Adjust guest starting cash
		- Adjust loan interest rate
		- Increase land/rights cost
		- Make some starting land buyable to increase difficulty
- Guest settings
	- Preferences
		- weight no preference
		- weight prefer less intense
		- weight prefer more intense
	- % start with umbrella
	- % narrow intensity preference
- Sim settings
	- lots.
	
# Updates as I write more

Having both a guest and financial difficulty slider is probably redundant. The guest one alone already governs available cash, and having two sliders that interact together in nonlinear fashion would just be confusing.

Instead, "how much loose cash do you have on average?" seemed like a better gauge of "how tight is this scenario financially"

## Spending plan review

Suppose you're in pay per entry with a guest number goal, you have choices of spending on:

- Rides for soft guest cap - the long term, dependable option for growth towards the goal
- Advertising campaigns (except free park entry) - probably (but not necessarily) profitable to spam continuously, but less long term friendly as the soft guest cap doesn't go up (unless the income can be put into that to outpace everything, which isn't guaranteed)
- Free park entry campaign - the short term option, this effectively costs a lot of money for more guests in the short term
- Pay back your high interest loan - playing the long game, spending money now to have more money later but no effect on guest count

I would expect to find that optimal play starts out aiming for profit (most likely: soft guest cap, the good advertising, loan repayment) and then at some date switches to guest emphasis (free park entry ad campaign). Trying to calculate this deterministically seems awful.

