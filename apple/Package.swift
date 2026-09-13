// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "ChillFlixVibes",
    platforms: [.macOS(.v13)],
    targets: [
        // `Shared/` and `Mac/` build the Mac app. `iOS/` is the other shell over
        // the same shared sources, built by the Xcode project `project.yml`
        // describes, and is kept out of this target rather than guarded file by
        // file.
        .executableTarget(name: "ChillFlixVibes", path: "Sources/ChillFlixVibes", exclude: ["iOS"])
    ]
)
