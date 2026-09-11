The recording catalogue includes word timestamps in seconds relative to each MP3, including its leading silence. Playback uses the audio clock to reveal complete words, so pauses and playback interruptions do not advance the text independently.

Timings were generated locally with whisper.cpp b4938, the base.en model, DTW alignment and flash attention disabled. These are machine-estimated alignments, not manually verified exact word onsets. Recording 3 transcribes “this” as “the”; its corresponding word position retains the supplied script. Recordings 53 and 74 were rerun without a prompt to recover their opening phrases. All 75 transcripts, timestamp ordering and duration bounds are validated by `verification/import-word-timings.cjs`.

To regenerate, place whisper-cli.exe in `%TEMP%/polygon-align/bin/Release/` and ggml-base.en.bin in `%TEMP%/polygon-align/`, run `node verification/extract-word-timings.cjs`, then `node verification/import-word-timings.cjs`. No audio is uploaded. Review any transcript mismatch before importing.

The current lesson uses 72 matching recordings. N016, F003 and F023 use speech synthesis because the supplied recordings contain older instructions. Speech synthesis word-boundary events drive their reveal where the browser provides them; browsers without these events retain the default visual timing.
