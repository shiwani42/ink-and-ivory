// Dev helper: switch the emulator's room (IWER SEM) without restarting the server.
//   echo kitchen > artifacts/room-name.txt ; npx iwsdk browser run tools/room.mjs
// Names: sunlit_living_room, home_office, kitchen, bedroom, conference_room,
// music_studio, open_office, open_studio; "none" removes every plane and mesh
// (a headset with no Space Setup). Needs --allow-browser-automation.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export default async function run({ page, workspaceRoot }) {
  const name = readFileSync(join(workspaceRoot, 'artifacts', 'room-name.txt'), 'utf8').trim();
  const results = [];
  for (const frame of page.frames()) {
    try {
      const r = await frame.evaluate(async (room) => {
        const sem = window.IWER_DEVICE?.sem;
        if (!sem) return 'no-sem';
        if (room === 'none') sem.deleteAll();
        else await sem.loadDefaultEnvironment(room);
        return 'ok';
      }, name);
      results.push(r);
    } catch (e) {
      results.push(String(e).slice(0, 120));
    }
  }
  return { room: name, results };
}
