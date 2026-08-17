// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "ChillFlixVibes",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(name: "ChillFlixVibes", path: "Sources/ChillFlixVibes")
    ]
)
