# Meta's hands-first sources, and what each means for a WebXR entry

Read in Nov 2026 while hardening Chausar's hand input. The success stories are Meta's own account of what makes a hands-first title work, so their takeaways double as the judges' vocabulary (see submission.md, "Speak Meta's language").

## Success stories (developers.meta.com, Nov 2026)
| Story | Link | Lessons we took |
|---|---|---|
| **Chess Club** (Odders Lab): hands and MR added to an established board game | https://developers.meta.com/vr/discover/success-stories/chess-club-odders-lab/ ([interview](https://www.youtube.com/watch?v=iOw3zYYlur8)) | Hands fit when the real action is already physical (reach, grab, place). Tracking lost mid-move → cancel, never execute. An undo. "The magic details": where you can grab, and how the grab feels. Answer gestures players already make (they used emoji). In MR, objects must behave as if they belong in the room. Board games suit MR: "a little virtual game in your real surroundings is cozy". |
| **Hand Physics Lab** (Holonautic): hands-first sandbox | https://developers.meta.com/vr/discover/success-stories/hand-physics-lab-holonautic/ | Interactions should feel like a non-event; if you must explain it, the design is wrong. Predict intent, "nothing unexpected should happen". On tracking loss, lock the hand and lerp back; never teleport. Physics where freedom matters, snapping or guided poses where clarity matters. "Don't be clever with the interaction; be clever around it" (give an eraser, not an erase gesture). Profile on device early. |
| **Table Troopers** (Cosmorama): hands-first MR tabletop strategy | https://developers.meta.com/vr/discover/success-stories/table-troopers/ | 90% reliability isn't enough for a game that matters; aim for 99.9%. Tint hands red *before* tracking is lost. Use the hand position from about 0.5 s before a release as the intent. Simplify the mechanic rather than complicating the input. One-handed play and colour-blind options. Test on device with people who've never used a headset. |

Shared takeaway: when input is ambiguous, don't act and don't punish; give a way back. Implemented patterns: hands-input.md, "Intent guardrails" and "Onboarding hands".

## Design guidance
| Resource | Link | Use |
|---|---|---|
| Hands Onboarding 101 | https://developers.meta.com/vr/blog/hands-onboarding-101-how-to-teach-hand-interations/ | Teach the core action as a real task first; keep a critical prompt up until the player succeeds; instructions follow the active input (hands vs controllers); confirm with sight and sound; define tracking-loss behaviour; replayable help and contextual reminders; test without coaching. |
| Adapt a controller-first title for Meta VR Glasses | https://developers.meta.com/vr/blog/adapt-your-controller-first-title-for-meta-vr-glasses/ | Only when targeting glasses (narrow view, gaze + pinch). Use the `iwsdk-glasses-test` skill. |
| Hand tracking overview | https://developers.meta.com/horizon/documentation/unity/unity-handtracking-overview/ | "Hands complement controllers": support both. Its wide-motion mode and the Interaction SDK are Unity-only. |
| Mixed reality overview | https://developers.meta.com/horizon/documentation/unity/mr-experience-and-use-cases/ | The MR vocabulary: passthrough, depth occlusion, scene understanding, anchors. A board on your coffee table is Meta's own MR example. |

## Engine-side tools (Unity/Unreal; what replaces them in WebXR)
| Tool | Link | In an IWSDK project |
|---|---|---|
| Interaction SDK (Unity / Unreal) | https://developers.meta.com/horizon/documentation/unity/unity-isdk-interaction-sdk-overview/ · https://developers.meta.com/horizon/documentation/unreal/unreal-isdk-overview/ | Not available. IWSDK's grab/poke/ray components and your own joint logic replace it; copy its ideas (hover, select and grab states). |
| Building Blocks | https://developers.meta.com/horizon/documentation/unity/bb-overview/ | Unity-only drag-and-drop features. IWSDK `iwsdk.config.json` features fill the role. |
| Meta XR SDK (all-in-one, incl. Platform SDK) | https://assetstore.unity.com/packages/tools/integration/meta-xr-all-in-one-sdk-269657 | Invites, leaderboards, in-app purchases, multiplayer: native store apps only, not a web page. |
| Voice SDK | https://developers.meta.com/horizon/documentation/unity/voice-sdk-overview/ | Soft-deprecated; Wit.ai needs explicit consent and a privacy policy. For a web entry: TTS out plus captions. Browser speech recognition in Quest Browser is unverified. |
| Meta XR Operator (blog, docs) | https://developers.meta.com/horizon/blog/meta-xr-operator-close-the-build-test-verify-loop-for-vr/ · https://developers.meta.com/horizon/documentation/unity/meta-xr-operator/ | An OpenXR layer that lets an AI agent see and drive a Unity app. For WebXR, the IWSDK CLI + IWER does the same and also drives individual fingers, which Operator can't yet. Its own caveat applies to us too: agents assume a screenshot "looks right", so verify with A/B pixel diffs. |
| Meta Quest / VR Developer Hub | https://developers.meta.com/horizon/documentation/unity/ts-mqdh/ | Windows/macOS: cast, record, Perfetto traces, deploy. On Linux the `metavr` CLI covers capture (`perf capture`, `analyze-trace`). |
| User Notifications, Developer Posts | https://developers.meta.com/horizon/documentation/unity/ps-user-notifications/ · https://developers.meta.com/horizon/blog/developer-posts-meta-horizon-os/ | Store-app retention channels; not available to a WebXR URL. |

## Programs
- **Meta Horizon Start:** https://developers.meta.com/horizon/discover/programs/start/ . Community, support and competitions. On 18 Nov 2026 the page said "Start members can compete for up to $100,000. Enter by Nov 18". Check the live page for current dates.
- Monthly newsletter: https://developers.meta.com/horizon/newsletter/ . Forum: https://communityforums.atmeta.com/category/horizon-developer-forum
