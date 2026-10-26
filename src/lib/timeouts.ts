/** CPU TTS on t3.xlarge can take several minutes. */
export const TTS_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
export const TTS_TIMEOUT_SECONDS = Math.floor(TTS_TIMEOUT_MS / 1000);
