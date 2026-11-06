# Book and Quill / Written Book (Java 1.7.10)

Evidence: `tools/probes/BookProbe.java` run by `tools/verify-book.mjs` against the unchanged JAR (client sha1 `e80d9b3b...`), stored in
`public/research/book-reference.json`; `src/books.test.js` checks the port against it. Classes: `ael` ItemWritableBook, `aem` ItemEditableBook,
`aew` RecipeBookCloning, `bfe` GuiScreenBook, `bff` the page arrows, `bbu` FontRenderer, `nh` NetHandlerPlayServer, `afe` CraftingManager.

## Verified by running the original classes (probe)
- Book and Quill: id 386, stack 1, Miscellaneous tab (index 4), no glint. Written Book: id 387, stack **16**, **no creative tab**, always glints.
- Names: "Book and Quill" / "Written Book" (en_US); a written book is named by its title when non-empty (not trimmed), with the gray line "by <author>" when the author is non-empty.
- Textures `book_writable`, `book_written`.
- Tag validation (`ael.a`, `aem.a`): `pages` must be a list, each page at most 256 chars, no page-count limit; a written book also needs a string `title` of at most 16 chars (empty allowed) and a string `author`. 21 cases.
- Recipe: shapeless book + ink sac (dye damage 0) + feather, in any order, 2x2 or 3x3. RecipeBookCloning: exactly one written book plus one or more writable books and nothing else; the result is a written book with count writables + 1 and a copy of the tag and display name. A written book without a tag throws a NullPointerException in the original (the port makes no result).
- FontRenderer widths for codes 32-126 and the word wrap (`listFormattedStringToWidth`, `sizeStringToWidth`, section-sign codes, bold +1) at widths 116/118/104/160 (64 records).

## Read from bytecode (javap), not run
- GuiScreenBook: 192 x 192 `textures/gui/book.png` at y 2; arrows 23 x 13 at (x+120, 156) forward and (x+38, 156) back; editable buttons Sign (id 3) and Done (id 0) at y 196 (98 x 20 at centre -100 / +2), signing screen Sign and Close (5) and Cancel (4); read-only Done is 200 wide at centre -100. Text at x+36, y 34, width 116; "Page x of y" right aligned ending 44 px from the page's right edge at y 18.
- Keys: Backspace deletes one char; Enter / keypad Enter inserts a newline (title screen: sends if the title is non-empty); a char is inserted only when the page still wraps within 118 px of height (13 lines, counting the cursor) and stays under 256 chars; title at most 16 chars; allowed characters exclude the section sign, controls and DEL. Cursor blinks every 6 ticks (black "_" / gray "_").
- Next on the last page adds a page (up to 50) and marks the book modified. Done / Sign and Close send only a modified book; trailing empty pages after the first are dropped. Escape discards. Cancel returns to the page.
- Server: `MC|BEdit` validates with `ael.a`, applies pages only to a held writable book; `MC|BSign` validates with `aem.a`, sets author to the sender's name, the packet's title and pages, and turns the held writable book into a written book. Invalid tags throw "Invalid book tag!".
- Right-click (no onItemUse) opens the screen: editable for the writable book, read-only for the written one.

## Approximations and gaps
- The GUI state machine is a port of the bytecode (`src/books.js` BookScreen), not driven through the original `bfe` (a headless driver needs a Minecraft and net-handler double and OpenGL; `tools/probes/BookGuiProbe.java` is an empty placeholder).
- Characters above code 126 use a width of 6 instead of the original unicode glyph tables; the browser font draws proportionally with the page font, so pixel placement differs slightly. Bold/italic section codes only recolor in the browser page.
- Page arrow hover texture, paste with a clipboard is wired (browser `paste` event), pasted text is inserted as one chunk (the original does the same through `pageInsertIntoCurrent`).
- The author name is always "Player" (no player names yet); the Written Book is craftable only by signing or cloning, and `/give` with a data tag.
