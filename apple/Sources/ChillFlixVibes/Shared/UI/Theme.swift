import SwiftUI

/// The app's palette, matching `tailwind.config.ts` so the Mac app and the web
/// app read as the same product.
///
/// Every value bar the brand mark and the rating star is neutral. Artwork is the
/// only colour on a streaming page, and a tinted ground or a tinted panel
/// competes with every poster on the screen.
enum Palette {
    static let background = Palette.hex(0x0A0A0A)
    static let surface = Palette.hex(0x141414)
    static let surfaceLight = Palette.hex(0x1F1F1F)
    static let muted = Palette.hex(0xA1A1AA)
    static let accent = Palette.hex(0xD4D4D8)
    /// The one place a brand colour is spent, on the mark itself — the same
    /// `primary-dark` tile the web app's navbar and footer carry.
    static let brand = Palette.hex(0x2563EB)
    static let rating = Palette.hex(0xFBBF24)

    /// Hairlines and glass fills are white at low opacity rather than fixed
    /// greys, so they hold their weight over pale artwork as well as over the
    /// ground.
    static let hairline = Color.white.opacity(0.10)
    static let hairlineBright = Color.white.opacity(0.25)
    static let glass = Color.white.opacity(0.10)
    static let glassHover = Color.white.opacity(0.18)
    /// The other glass: black rather than white, for the small plates that sit
    /// *on* artwork and have to stay legible over a pale frame.
    static let scrim = Color.black.opacity(0.6)

    private static func hex(_ value: UInt32) -> Color {
        Color(
            .sRGB,
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255
        )
    }
}
