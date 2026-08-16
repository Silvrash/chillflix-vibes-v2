package com.chillflixvibes.tv.player

import android.content.Context
import org.mozilla.geckoview.ContentBlocking
import org.mozilla.geckoview.GeckoRuntime
import org.mozilla.geckoview.GeckoRuntimeSettings

/**
 * The Gecko runtime, tuned for the hardware this engine exists to serve:
 * televisions with a handful of slow cores and under a gigabyte of RAM.
 *
 * The settings below matter more than they look. A provider page spends most of
 * its effort on things the viewer never sees — ad networks, analytics beacons
 * and an anti-devtools script that throws twice a second for the entire film —
 * and on a 2016 SoC that is a real share of the CPU. Blocking them is the
 * cheapest speed-up available, because the fastest work is the work not done.
 *
 * Settings are builder-time only, so the runtime has to be created rather than
 * fetched with `getDefault()`.
 */
object GeckoEngine {

    @Volatile
    private var instance: GeckoRuntime? = null

    /**
     * One runtime per process — a second `create` throws. Safe to call early:
     * warming it while the user is still browsing moves Gecko's start-up cost
     * off the moment they press Play.
     */
    fun runtime(context: Context): GeckoRuntime =
        instance ?: synchronized(this) {
            instance ?: build(context.applicationContext).also { instance = it }
        }

    private fun build(context: Context): GeckoRuntime {
        val blocking = ContentBlocking.Settings.Builder()
            .antiTracking(
                ContentBlocking.AntiTracking.AD or
                    ContentBlocking.AntiTracking.ANALYTIC or
                    ContentBlocking.AntiTracking.SOCIAL or
                    ContentBlocking.AntiTracking.CRYPTOMINING or
                    ContentBlocking.AntiTracking.FINGERPRINTING,
            )
            .build()

        val settings = GeckoRuntimeSettings.Builder()
            .contentBlocking(blocking)
            // Every blocked script would otherwise cross into logcat. The
            // provider's anti-devtools loop alone emits a message twice a
            // second for the length of the film.
            .consoleOutput(false)
            // Render the page at 720p. The video still decodes in hardware at
            // its own resolution — this only cuts the compositor's pixel work,
            // to roughly 44% of a 1080p surface.
            .screenSizeOverride(1280, 720)
            .displayDensityOverride(1.0f)
            // Player chrome is the only text on screen, and it doesn't need
            // downloaded fonts.
            .webFontsEnabled(false)
            .build()

        return GeckoRuntime.create(context, settings)
    }
}
