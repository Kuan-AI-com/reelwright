# Publishing AI-made videos responsibly

Reelwright makes it easy to produce a lot of video. This page covers the rules that apply once you **publish** them. It is practical guidance, **not legal advice**. Laws differ by country and change often, so check the current rules for where you and your audience are.

## 1. Label it as AI-generated (on by default)

Each video Reelwright renders carries two labels:

- **A small on-screen label**, "AI-generated", localized to the video's language (for example "Generado con IA").
- **Machine-readable metadata** in the MP4: `comment`, `ai_generated=true` and `synthetic_media=…`.

Why this is on by default:

- **EU AI Act, Article 50.** Applies from 2 August 2026. Deployers of AI systems that generate or manipulate image, audio or video content constituting a deep fake must disclose that the content was artificially generated. Providers must mark synthetic output in a machine-readable way. Narrated explainers with a synthetic voice are a grey area, and labelling costs you nothing.
- **YouTube.** Creators must use the "altered or synthetic content" setting when realistic content was made or meaningfully altered with AI. A synthetic voice reading a script can fall under this.
- **TikTok and Meta.** Both require or apply "AI-generated" labels on realistic AI content and may label it automatically.

**What you still have to do:** when you upload, tick the platform's own AI or synthetic-content box. The studio reminds you on the "Ready" screen.

You *can* switch the labels off with `AI_DISCLOSURE=false`, for example when the video goes through your own editor where you add disclosure yourself. If you do, disclosure becomes your responsibility.

## 2. Voices: synthetic only, no cloning

Reelwright ships with the stock **Kokoro-82M** voices (Apache-2.0). They are synthetic speakers, not imitations of real people.

- **Do not** add a voice cloned from a real person without their **written consent**. Several jurisdictions protect a person's voice and likeness: right-of-publicity laws, Tennessee's ELVIS Act, and Spain's and other EU countries' personality rights. Doing so also breaks most platforms' rules.
- **Do not** present the narrator as a real, named person.

## 3. Facts, numbers and quotes

The script writer is instructed to avoid inventing statistics or quotes, and to put a short source line under every number. **LLMs still make things up.** Before you approve a script:

- Check every number and quote against its source. The `source` field appears on screen; make it accurate.
- Watch for misattributed quotes. They are the most common error.
- Be careful with health, finance, legal and election topics. Platforms apply stricter policies to them, and a wrong claim can cause real harm.

The editorial board exists for this reason: nothing renders until a person approves the script.

## 4. Music and images

- **Music:** use only tracks you made, licensed, or that are explicitly **CC0 / public domain**. "Royalty-free" is not the same as free to use. Read the license, especially for monetized channels. Content ID systems flag unlicensed music even when it is quiet.
- **Images and logos** you add to a storyboard keep their owners' rights. Do not use trademarks in a way that suggests endorsement.
- The bundled fonts are under the SIL Open Font License, which allows using them in videos, including commercial ones.

## 5. Copyright in the output

- In many places, including the United States under current Copyright Office guidance, purely AI-generated material is not protected by copyright. Your own human contributions are: your script edits, your selection and arrangement, your footage. Keep your edits; they are your authorship.
- Reelwright's license (Apache-2.0) puts **no** restrictions or attribution requirements on the videos you make.

## 6. Privacy and your data

- Reelwright is self-hosted. Your scripts, audio and videos stay on your server, under `/data`.
- **Text-to-speech, captions and rendering run locally.** The only external calls are:
  - **The LLM provider you configure**, to draft scripts. It receives your topic and notes; check that provider's data policy. With `LLM_PROVIDER=ollama` nothing leaves your server.
  - **First-run downloads**: the voice model, the Whisper model if enabled, theme fonts from Google Fonts, and Chrome when running outside Docker. After that, they are cached.
- HyperFrames telemetry is **switched off** for every command Reelwright runs.
- **Do not** put personal data about other people (names, faces, health information) into videos without a legal basis. In the EU that means the GDPR.

## 7. Platform rules worth knowing

- **Mass-produced content.** YouTube's monetization policy excludes "mass-produced or repetitive" content. Uploading many near-identical template videos can cost you monetization. Make each video worth watching.
- **Spam and misleading metadata.** Titles and thumbnails must match the content.

---

Found something outdated or wrong here? Please open an issue: this page is maintained by the community.
