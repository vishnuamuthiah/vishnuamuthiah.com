// Flatten every near-navy pixel in the OG card to one exact colour.
//
// The card is a composite: a slide background, text boxes, and a pasted
// screenshot of the arrow, each carrying a slightly different navy (#111A2F,
// #0E1B33, #111B31, #111B34, ...). They are within ~5 RGB units of each other,
// so the panels are invisible on most screens -- but the arrow's screenshot
// background is noisy as well as off-tone, and that one does show.
//
// Rather than re-cutting the screenshot, remap anything within `tolerance` of
// navy onto the target. White text (#FFFFFF) and the arrow's blue (#83CAF1) are
// far outside the radius and untouched, as are the anti-aliased blends along
// glyph edges -- those must stay, or the text gets a hard jagged edge.
//
//   swift tools/flatten-navy.swift <in.png> <out.png> [tolerance]
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

let args = CommandLine.arguments
guard args.count >= 3 else {
    FileHandle.standardError.write("usage: flatten-navy.swift <in.png> <out.png> [tolerance]\n".data(using: .utf8)!)
    exit(2)
}
let tolerance = args.count > 3 ? Double(args[3])! : 15.0

// AppTheme.launchNavy — the app's own launch-screen ground.
let target: (r: UInt8, g: UInt8, b: UInt8) = (0x0E, 0x1B, 0x33)

guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: args[1]) as CFURL, nil),
      let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else { exit(1) }

let w = img.width, h = img.height
var buf = [UInt8](repeating: 0, count: w * h * 4)
guard let ctx = CGContext(data: &buf, width: w, height: h, bitsPerComponent: 8,
                          bytesPerRow: w * 4, space: CGColorSpaceCreateDeviceRGB(),
                          bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { exit(1) }
ctx.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))

var changed = 0
for i in stride(from: 0, to: w * h * 4, by: 4) {
    let dr = Double(buf[i])     - Double(target.r)
    let dg = Double(buf[i + 1]) - Double(target.g)
    let db = Double(buf[i + 2]) - Double(target.b)
    if (dr * dr + dg * dg + db * db).squareRoot() <= tolerance {
        buf[i] = target.r; buf[i + 1] = target.g; buf[i + 2] = target.b
        changed += 1
    }
}

guard let out = ctx.makeImage(),
      let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: args[2]) as CFURL,
                                                 UTType.png.identifier as CFString, 1, nil) else { exit(1) }
CGImageDestinationAddImage(dest, out, nil)
guard CGImageDestinationFinalize(dest) else { exit(1) }

print(String(format: "flattened %d/%d px (%.1f%%) within %.0f of #%02X%02X%02X",
             changed, w * h, Double(changed) / Double(w * h) * 100, tolerance,
             target.r, target.g, target.b))
