---
name: KakiMETch
description: Calm patient case blocks for medical transport coordination
---

# Design System: KakiMETch

## Overview

**Creative North Star: "The Case-File Blocks"**

KakiMETch should feel like the clearest version of Rose's physical and spreadsheet workflow: a small set of patient case blocks that open into one well-organized case sheet. The visual system is operational rather than decorative. It uses daylight surfaces, dark ink, one restrained teal voice and plain state language so the interface disappears into the decision.

The system is familiar without imitating a spreadsheet. Each patient is a self-contained module showing only the details needed to choose a case. Opening a module places one focused case sheet over a muted overview, so the queue and matching information never compete for attention. A quiet accepted mark, visible match reasons and a separate confirmation action keep the human decision unmistakable.

**Key Characteristics:**
- Daylight, low-glare neutral surfaces with restrained teal actions.
- Strong text hierarchy using Windows-native workhorse typography.
- Large patient modules on the overview; one focused case sheet after selection.
- State motion is short and functional; no decorative page choreography.

## Colors

Use a restrained strategy: neutral work surfaces plus one teal accent, with conventional semantic warning, error and success colors.

- Desk `#f4f5f2`, paper `#ffffff`, soft paper `#f8f9f7`
- Ink `#18221f`, supporting text `#5d6965`, quiet text `#66716d`, rules `#d5dcd8`
- Teal action `#276866`, dark teal `#1f5351`, teal wash `#eaf2f0`
- Success `#2f6d50`, warning `#855c20`, error `#a23a33`
- Keyboard focus `#087f78`, always paired with a 3px visible outline

**The One Teal Voice Rule.** Teal identifies the current selection, keyboard focus and primary action; it is never scattered as decoration.

## Typography

**Display Font:** Segoe UI (with system-ui fallback)
**Body Font:** Segoe UI (with system-ui fallback)

**Character:** Familiar on Loving Heart's Windows computers, highly legible at ordinary working distances and neutral enough to carry dense operational information without feeling technical.

**The Comfortable Baseline Rule.** Body text begins at 16px, controls never depend on tiny helper text, and data labels remain readable without zooming.

## Layout

The overview uses a restrained grid of large patient modules, normally two per row on desktop and one per row on small screens. Selecting a module opens a 760px right-side case drawer; below 760px the drawer becomes a full-screen, single-column view with a clear “All patients” action. Information is disclosed in task order: appointment, patient matching needs, suggestions and confirmation. Nothing compresses into an unreadable mini-spreadsheet.

## Core Components

- **Patient module:** name, appointment date/time and destination only; overdue status is written in text.
- **Case drawer:** modal, keyboard-contained detail view with appointment summary and editable matching profile.
- **Need row:** consistent icon, label, value and optional plain-language note.
- **Escort suggestion:** native radio selection, escort identity and human-readable reasons; never a numeric score.
- **Confirmation area:** selection summary plus a separate explicit confirmation action.
- **Manual override:** exceptional warning state showing the full roster, conflict reasons and a required written rationale.
- **Completion summary:** remains open after saving and offers “Match next appointment” deliberately.

## Elevation & Depth

Depth comes primarily from tonal surface changes and structural dividers. Shadows are reserved for genuinely raised or sticky controls and remain soft, downward and low contrast.

**The Flat-by-Default Rule.** Containers sit in the page hierarchy through surface and spacing; elevation appears only when an element physically overlays content.

## Shapes

Corners are gently practical rather than pillowy. Fields and action buttons share a compact radius; status chips may use a capsule only when their text is short. Dividers are thin and quiet.

## Do's and Don'ts

### Do:
- **Do** make every patient a clearly bounded, clickable module with a name, appointment time and destination.
- **Do** show only one patient's matching information at a time.
- **Do** show one clear primary action and the consequence of completing it.
- **Do** express match reasoning with plain-language tags and full error recovery guidance.

### Don't:
- **Don't** expose numeric match scores, NRIC or unexplained system language.
- **Don't** hide actions behind hover, icons without labels or color alone.
- **Don't** introduce driver, vehicle, routing or reporting concepts into the matching workspace.
