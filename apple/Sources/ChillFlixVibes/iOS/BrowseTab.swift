import SwiftUI

/// The three catalogue sections behind one tab.
///
/// A phone's tab bar holds five things and the site has six — home, three
/// sections, search, the viewer — so the sections share a tab and a switch,
/// the way every streaming app on the platform folds its catalogue. The
/// switch is a segmented control rather than three tabs of its own because it
/// is one question, "which catalogue", not three destinations.
struct BrowseTab: View {
    @State private var section: BrowseSection = .movies

    var body: some View {
        VStack(spacing: 0) {
            Picker("Section", selection: $section) {
                ForEach(BrowseSection.allCases, id: \.self) { section in
                    Text(section.label).tag(section)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, Metric.gutter)
            .padding(.top, 8)
            .padding(.bottom, 4)

            // A new identity per section, so the grid, the page count and the
            // chosen category all start over rather than carrying across.
            BrowseView(section: section, showsHeading: false)
                .id(section)
        }
        .background(Palette.background)
        .navigationTitle("Browse")
        .rootScreen()
    }
}
