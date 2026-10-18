# Employee Hierarchy: user guide

Employee Hierarchy is where you look up who works at EPI-USE Africa, who they report to, and keep their records up to date. This guide walks through each part of the application.

- [Signing in](#signing-in)
- [What you can do depends on your account](#what-you-can-do-depends-on-your-account)
- [Home](#home)
- [Org chart](#org-chart)
- [Employees table](#employees-table)
- [Adding and editing an employee](#adding-and-editing-an-employee)
- [Deleting an employee](#deleting-an-employee)
- [Audit trail](#audit-trail)
- [Profile pictures](#profile-pictures)
- [Messages you might see](#messages-you-might-see)

## Signing in

1. Open the address you were given for Employee Hierarchy.
2. Enter your **Email** and **Password**, then select **Sign in**.

You stay signed in if you refresh the page or come back later in the same browser. For your security, a session that has not been used for a week ends, and you are taken back to the sign-in page; the same happens if you sign out in another tab. After signing in again, you return to the page you were on.

To sign out, open the menu with your email address in the top right corner and select **Sign out**.

## What you can do depends on your account

There are two kinds of account. Your administrator chooses which one you have; the menu in the top right corner shows which.

| You can…                                  | Administrator | Viewer |
| ----------------------------------------- | :-----------: | :----: |
| See the org chart and the employees table |      Yes      |  Yes   |
| See salaries                              |      Yes      |   No   |
| Add, edit and delete employees            |      Yes      |   No   |
| See the audit trail                       |      Yes      |   No   |
| Keep your own task list on Home           |      Yes      |  Yes   |

Viewers see **Hidden** wherever a salary would appear, and cannot sort or filter by salary.

## Home

Home is the first page you see after signing in. It shows:

- **Your profile:** your name, role, employee number and who you report to, with counts of your direct reports, open tasks and overdue tasks.
- **Your team:** you, then everyone who reports directly to you, with how many open tasks each person has. Select someone to jump to their tasks.
- **What you're working on:** your task list.

### Your tasks

- To add a task, type it in **Add a task** and select **Add**.
- To mark a task as done, tick its box. Untick it to reopen it.
- Tasks are listed with work in progress first, then to-do, then done, earliest due date first. An overdue task shows **Overdue** in red.

Select **Team tasks** to see your own list followed by each of your direct reports' lists. You can read your team's tasks but only tick off your own.

If your account is not linked to an employee record, Home shows a short message instead, and you can go straight to the org chart.

## Org chart

**Org chart** shows the whole organisation as a tree, with each person under their manager. The number on a card is how many people report directly to that person.

- **Move around:** drag the background to pan, and scroll or use the **+** and **−** buttons in the bottom left corner to zoom. The button below them fits the whole chart on screen. The small map in the bottom right corner shows where you are.
- **Find someone:** select **Find an employee**, or press **Ctrl+K** (**⌘K** on a Mac), and type a name, role or employee number. Choose a result and the chart moves to that person.
- **See someone's details:** select their card. A panel opens on the right with their employee number, email, birth date, salary, manager and direct reports. Select a manager's or report's name to move to them.

If more than one person has no manager, a warning above the chart lists them. Usually only the CEO sits at the top, so check whether the others should report to someone.

Administrators also see buttons in the details panel:

- **Edit** opens the person's record.
- **Add report** adds a new employee who reports to this person.
- The bin icon deletes them (see [Deleting an employee](#deleting-an-employee)).

## Employees table

**Employees** lists everyone in a table you can search, filter and sort.

- **Search:** type in **Search name, number, email or role**. Every word you type must match, so _thandi nkosi_ finds Thandi Nkosi.
- **Filter:** choose a role from **All roles**, or a manager from **All managers**. Choose **No manager** to see everyone at the top of the organisation.
- **Clear:** select **Clear** to remove the search and filters.
- **Sort:** select a column heading. Select it again to reverse the order.
- **Pages:** the table shows 25 people at a time. Use the arrows below it to move between pages.

Administrators can edit or delete someone from the **⋯** menu at the end of their row, and add someone with **Add employee**.

## Adding and editing an employee

Select **Add employee** (on the org chart or the employees table), or **Edit** for an existing person. Fill in the form and select **Add employee** or **Save changes**.

| Field                       | What to enter                                                                                      |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| **First name**, **Surname** | The person's name.                                                                                 |
| **Employee number**         | In the format E-0000, for example E-0042. Every employee number must be unique.                    |
| **Birth date**              | Select **Choose a date** and pick from the calendar. Use the month and year lists to jump quickly. |
| **Email**                   | Their work email. It must be unique, and it is used to show their profile picture.                 |
| **Role / position**         | Their job title.                                                                                   |
| **Annual salary (ZAR)**     | A number, without spaces or the currency symbol.                                                   |
| **Reporting line manager**  | Who they report to, or **No manager (top of the hierarchy)**.                                      |

To move someone to a different manager, edit them and change **Reporting line manager**.

**A person cannot end up reporting to themselves.** When you edit someone, the manager list leaves out that person and everyone below them in the organisation, because choosing one of them would create a loop. If two people make conflicting changes at the same time and a loop would still result, the change is refused and the message names the people involved.

Every change is recorded in the audit trail.

## Deleting an employee

Select the bin icon in the org chart's details panel, or **Delete** in the table's **⋯** menu.

If the person has no direct reports, confirm with **Delete employee**.

If they manage people, you must choose where their team goes:

- **Move them up a level:** the team reports to the deleted person's own manager. This option is not available for someone with no manager.
- **Hand them over to someone else:** choose the new manager from the list. People in the departing manager's own team are left out of the list.

**Who moves** shows each person and their new manager before you confirm. Select **Delete employee** to finish.

Deleting is permanent. The audit trail keeps a record of the person and of every move, but the record cannot be restored from the application.

## Audit trail

**Audit trail** (administrators only) lists every change to an employee record, newest first:

- **When** the change was made.
- **Change:** **Created**, **Updated**, **Manager changed** or **Deleted**.
- **Employee** affected.
- **Details**, for example _Position and salary updated_ or _Manager changed from Aisha Patel to Ruan Pretorius_.
- **Changed by:** the account that made it. **System** means the change came from outside the application, such as the initial data load.

Use **All changes** to show only one kind of change. Entries cannot be edited or deleted.

## Profile pictures

Each person's picture comes from [Gravatar](https://gravatar.com), using their email address. If that email has no Gravatar picture, their initials are shown on a coloured circle instead. To change a picture, the person updates it on gravatar.com; it appears here automatically.

## Messages you might see

| Message                                                                | What it means                                                                                     |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| _That email and password do not match an account._                     | Check both and try again. Ask your administrator if you have forgotten your password.             |
| _Another record already uses that employee number._ (or email address) | Employee numbers and emails must be unique. Check for an existing record.                         |
| _That change would create a reporting loop: …_                         | The chosen manager already reports to this person, directly or further down. Choose someone else. |
| _Something went wrong. Check your connection and try again._           | The application could not reach the server. Check your connection and try again.                  |
