const ROOT = "/media/1.7.10";
const COLORS = { 2: "#00aa00", 3: "#00aaaa", 7: "#aaaaaa", e: "#ffff55", f: "#ffffff" };

function textRows(container, text) {
  for (const line of text.replaceAll("PLAYERNAME", "Player").split(/\r?\n/)) {
    const row = document.createElement("div");
    if (line.startsWith("[C]")) row.className = "end-credits-center";
    const runs = line.replace(/^\[C\]/, "").split(/(§[\da-fk-or])/i);
    let color = "#fff", obfuscated = false;
    for (const run of runs) {
      if (run.startsWith("§") && run.length === 2) {
        const code = run[1];
        if (COLORS[code]) { color = COLORS[code]; obfuscated = false; }
        if (code === "k") obfuscated = true;
      } else if (run) {
        const span = document.createElement("span");
        span.style.color = color;
        span.textContent = obfuscated ? run.replace(/\S/g, "▓") : run;
        row.append(span);
      }
    }
    container.append(row);
  }
}

export function showEndCredits() {
  return new Promise(resolve => {
    const screen = document.createElement("section");
    screen.className = "end-credits";
    screen.setAttribute("role", "dialog");
    screen.setAttribute("aria-modal", "true");
    screen.setAttribute("aria-label", "End poem and credits");
    const content = document.createElement("div");
    content.className = "end-credits-roll";
    const logo = document.createElement("div");
    logo.className = "end-credits-logo";
    logo.setAttribute("role", "img");
    logo.setAttribute("aria-label", "Minecraft");
    logo.append(document.createElement("span"), document.createElement("span"));
    const skip = document.createElement("button");
    skip.className = "end-credits-skip";
    skip.textContent = "Return to world";
    content.append(logo);
    screen.append(content, skip);
    document.body.append(screen);
    skip.focus();
    let animation;
    const close = () => {
      window.removeEventListener("keydown", escape, true);
      animation?.cancel();
      screen.remove();
      resolve();
    };
    const escape = event => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    };
    window.addEventListener("keydown", escape, true);
    skip.onclick = close;
    Promise.all(["end", "credits"].map(async name => {
      const res = await fetch(ROOT + "/texts/" + name + ".txt");
      return res.ok ? res.text() : "";
    })).then(([poem, credits]) => {
      if (!screen.isConnected) return;
      textRows(content, poem);
      textRows(content, "\n\n\n" + credits);
      const distance = screen.clientHeight + content.scrollHeight + 48;
      // GuiWinGame scrolls by half a GUI pixel per tick. The browser uses a
      // fixed 2× scale and keeps an accessible skip control during the roll.
      animation = content.animate([{ transform: "translateY(0)" }, { transform: `translateY(-${distance}px)` }], distance * 50);
      animation.onfinish = close;
    }).catch(() => { /* The return button is available if the text fails to load. */ });
  });
}
