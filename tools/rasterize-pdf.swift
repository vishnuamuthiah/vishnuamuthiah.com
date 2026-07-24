// Rasterize a PDF page to a PNG at an exact pixel size, drawing the vectors at
// the target resolution rather than scaling up a low-res bitmap.
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

let args = CommandLine.arguments
guard args.count == 5,
      let W = Int(args[3]), let H = Int(args[4]) else {
    FileHandle.standardError.write("usage: rasterize.swift <in.pdf> <out.png> <width> <height>\n".data(using: .utf8)!)
    exit(2)
}

guard let doc = CGPDFDocument(URL(fileURLWithPath: args[1]) as CFURL),
      let page = doc.page(at: 1) else {
    FileHandle.standardError.write("could not open PDF\n".data(using: .utf8)!)
    exit(1)
}

let box = page.getBoxRect(.mediaBox)

guard let ctx = CGContext(data: nil, width: W, height: H,
                          bitsPerComponent: 8, bytesPerRow: 0,
                          space: CGColorSpaceCreateDeviceRGB(),
                          bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else {
    exit(1)
}
ctx.interpolationQuality = .high
ctx.setAllowsAntialiasing(true)
ctx.setShouldAntialias(true)
ctx.setShouldSmoothFonts(true)

// Opaque white underneath: og:image must not be transparent, or clients that
// composite it on a dark chrome get unreadable text.
ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))

ctx.scaleBy(x: CGFloat(W) / box.width, y: CGFloat(H) / box.height)
ctx.translateBy(x: -box.origin.x, y: -box.origin.y)
ctx.drawPDFPage(page)

guard let img = ctx.makeImage(),
      let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: args[2]) as CFURL,
                                                 UTType.png.identifier as CFString, 1, nil) else {
    exit(1)
}
CGImageDestinationAddImage(dest, img, nil)
guard CGImageDestinationFinalize(dest) else { exit(1) }

let ratioIn = box.width / box.height
let ratioOut = CGFloat(W) / CGFloat(H)
print(String(format: "source %.2fx%.2fpt (%.4f) -> %dx%d (%.4f)%@",
             box.width, box.height, ratioIn, W, H, ratioOut,
             abs(ratioIn - ratioOut) > 0.01 ? "  ⚠️ ASPECT MISMATCH — content will stretch" : ""))
