import { parse, match } from "../src"

describe("parse()", () => {
  it("should parse media queries without expressions", () => {
    expect(parse("screen")).toEqual([
      {
        inverse: false,
        type: "screen",
        expressions: [],
      },
    ])

    expect(parse("not screen")).toEqual([
      {
        inverse: true,
        type: "screen",
        expressions: [],
      },
    ])
  })

  it("should parse common retina media query list", () => {
    const parsed = parse(`
      only screen and (-webkit-min-device-pixel-ratio: 2),
      only screen and (   min--moz-device-pixel-ratio: 2),
      only screen and (     -o-min-device-pixel-ratio: 2/1),
      only screen and (        min-device-pixel-ratio: 2),
      only screen and (                min-resolution: 192dpi),
      only screen and (                min-resolution: 2dppx)
    `)

    expect(parsed).toBeInstanceOf(Array)
    expect(parsed).toHaveLength(6)
    expect(parsed[0].expressions[0].feature).toBe("device-pixel-ratio")
    expect(parsed[1].expressions[0].modifier).toBe("min")
  })

  it("should throw a SyntaxError when a media query is invalid", () => {
    expect(() => parse("some crap")).toThrow(SyntaxError)
    expect(() => parse("48em")).toThrow(SyntaxError)
    // expect(() => parse("screen and crap")).toThrow(SyntaxError)
    expect(() => parse("screen and (48em)")).toThrow(SyntaxError)
    expect(() => parse("screen and (foo:)")).toThrow(SyntaxError)
    expect(() => parse("()")).toThrow(SyntaxError)
    expect(() => parse("(foo) (bar)")).toThrow(SyntaxError)
    expect(() => parse("(foo:) and (bar)")).toThrow(SyntaxError)
  })
})

describe("match()", () => {
  describe("Equality Check", () => {
    it("Orientation: should return true for a correct match (===)", () => {
      expect(
        match("(orientation: portrait)", {
          orientation: "portrait",
        }),
      ).toBe(true)
    })

    it("Orientation: should return false for an incorrect match (===)", () => {
      expect(
        match("(orientation: landscape)", {
          orientation: "portrait",
        }),
      ).toBe(false)
    })

    it("Width: should return true for a correct match", () => {
      expect(match("(width: 800px)", { width: 800 })).toBe(true)
    })

    it("Width: should return false for an incorrect match", () => {
      expect(match("(width: 800px)", { width: 900 })).toBe(false)
    })
  })

  describe("Length Check", () => {
    describe("Width", () => {
      it("should return true for a width higher than a min-width", () => {
        expect(match("(min-width: 48em)", { width: "80em" })).toBe(true)
      })

      it("should return false for a width lower than a min-width", () => {
        expect(match("(min-width: 48em)", { width: "20em" })).toBe(false)
      })

      it("should return false when no width value is specified", () => {
        expect(match("(min-width: 48em)", { resolution: 72 })).toBe(false)
      })
    })

    describe("Different Units", () => {
      it("should work with ems", () => {
        expect(match("(min-width: 500px)", { width: "48em" })).toBe(true)
      })

      it("should work with rems", () => {
        expect(match("(min-width: 500px)", { width: "48rem" })).toBe(true)
      })

      it("should work with cm", () => {
        expect(match("(max-height: 1000px)", { height: "20cm" })).toBe(true)
      })

      it("should work with mm", () => {
        expect(match("(max-height: 1000px)", { height: "200mm" })).toBe(true)
      })

      it("should work with inch", () => {
        expect(match("(max-height: 1000px)", { height: "20in" })).toBe(false)
      })

      it("should work with pt", () => {
        expect(match("(max-height: 1000px)", { height: "850pt" })).toBe(false)
      })

      it("should work with pc", () => {
        expect(match("(max-height: 1000px)", { height: "60pc" })).toBe(true)
      })

      it("should work with literal 0", () => {
        expect(match("(max-height: 1000px)", { height: 0 })).toBe(true)
      })
    })
  })

  describe("Resolution Check", () => {
    it("should return true for a resolution match", () => {
      expect(match("(resolution: 50dpi)", { resolution: 50 })).toBe(true)
    })

    it("should return true for a resolution higher than a min-resolution", () => {
      expect(match("(min-resolution: 50dpi)", { resolution: 72 })).toBe(true)
    })

    it("should return false for a resolution higher than a max-resolution", () => {
      expect(match("(max-resolution: 72dpi)", { resolution: 300 })).toBe(false)
    })

    it("should return false if resolution isnt passed in", () => {
      expect(match("(min-resolution: 72dpi)", { width: 300 })).toBe(false)
    })

    it("should convert units properly", () => {
      expect(match("(min-resolution: 72dpi)", { resolution: "75dpcm" })).toBe(
        false,
      )

      expect(match("(resolution: 192dpi)", { resolution: "2dppx" })).toBe(true)
    })
  })

  describe("Aspect Ratio Check", () => {
    it("should return true for an aspect-ratio higher than a min-aspect-ratio", () => {
      expect(
        match("(min-aspect-ratio: 4/3)", {
          "aspect-ratio": "16 / 9",
        }),
      ).toBe(true)
    })

    it("should return false for an aspect-ratio higher than a max-aspect-ratio", () => {
      expect(match("(max-aspect-ratio: 4/3)", { "aspect-ratio": "16/9" })).toBe(
        false,
      )
    })

    it("should return false if aspect-ratio isnt passed in", () => {
      expect(match("(max-aspect-ratio: 72dpi)", { width: 300 })).toBe(false)
    })

    it("should work numbers", () => {
      expect(
        match("(min-aspect-ratio: 2560/1440)", {
          "aspect-ratio": 4 / 3,
        }),
      ).toBe(false)
    })
  })

  describe("Grid/Color/Color-Index/Monochrome", () => {
    it("should return true for a correct match", () => {
      expect(match("(grid)", { grid: 1 })).toBe(true)

      expect(match("(color)", { color: 1 })).toBe(true)

      expect(match("(color-index: 3)", { "color-index": 3 })).toBe(true)

      expect(match("(monochrome)", { monochrome: 1 })).toBe(true)
    })

    it("should return false for an incorrect match", () => {
      expect(match("(grid)", { grid: 0 })).toBe(false)

      expect(match("(color)", { color: 0 })).toBe(false)

      expect(match("(color-index: 3)", { "color-index": 2 })).toBe(false)

      expect(match("(monochrome)", { monochrome: 0 })).toBe(false)

      expect(match("(monochrome)", { monochrome: "foo" as any })).toBe(false)
    })
  })

  describe("Type", () => {
    it("should return true for a correct match", () => {
      expect(match("screen", { type: "screen" })).toBe(true)
    })

    it("should return false for an incorrect match", () => {
      expect(
        match("screen and (color: 1)", {
          type: "tv",
          color: 1,
        }),
      ).toBe(false)
    })

    it("should return false for a media query without a type when type is specified in the value object", () => {
      expect(match("(min-width: 500px)", { type: "screen" })).toBe(false)
    })

    it("should return true for a media query without a type when type is not specified in the value object", () => {
      expect(match("(min-width: 500px)", { width: 700 })).toBe(true)
    })
  })

  describe("Not", () => {
    it("should return false when theres a match on a `not` query", () => {
      expect(
        match("not screen and (color)", {
          type: "screen",
          color: 1,
        }),
      ).toBe(false)
    })

    it("should not disrupt an OR query", () => {
      expect(
        match("not screen and (color), screen and (min-height: 48em)", {
          type: "screen",
          height: 1000,
        }),
      ).toBe(true)
    })

    it("should return false for when type === all", () => {
      expect(
        match("not all and (min-width: 48em)", {
          type: "all",
          width: 1000,
        }),
      ).toBe(false)
    })

    it("should return true for inverted value", () => {
      expect(match("not screen and (min-width: 48em)", { width: "24em" })).toBe(
        true,
      )
    })
  })

  describe("match() Integration Tests", () => {
    describe("Real World Use Cases (mostly AND)", () => {
      it("should return true because of width and type match", () => {
        expect(
          match("screen and (min-width: 767px)", {
            type: "screen",
            width: 980,
          }),
        ).toBe(true)
      })

      it("should return true because of width is within bounds", () => {
        expect(
          match("screen and (min-width: 767px) and (max-width: 979px)", {
            type: "screen",
            width: 800,
          }),
        ).toBe(true)
      })

      it("should return false because width is out of bounds", () => {
        expect(
          match("screen and (min-width: 767px) and (max-width: 979px)", {
            type: "screen",
            width: 980,
          }),
        ).toBe(false)
      })

      it("should return false since monochrome is not specified", () => {
        expect(match("screen and (monochrome)", { width: 980 })).toBe(false)
      })

      it("should return true since color > 0", () => {
        expect(
          match("screen and (color)", {
            type: "screen",
            color: 1,
          }),
        ).toBe(true)
      })

      it("should return false since color = 0", () => {
        expect(
          match("screen and (color)", {
            type: "screen",
            color: 0,
          }),
        ).toBe(false)
      })
    })

    describe("Grouped Media Queries (OR)", () => {
      it("should return true because of color", () => {
        expect(
          match("screen and (min-width: 767px), screen and (color)", {
            type: "screen",
            color: 1,
          }),
        ).toBe(true)
      })

      it("should return true because of width and type", () => {
        expect(
          match("screen and (max-width: 1200px), handheld and (monochrome)", {
            type: "screen",
            width: 1100,
          }),
        ).toBe(true)
      })

      it("should return false because of monochrome mis-match", () => {
        expect(
          match("screen and (max-width: 1200px), handheld and (monochrome)", {
            type: "screen",
            monochrome: 0,
          }),
        ).toBe(false)
      })
    })
  })

  describe("match() AST", () => {
    it("should take parsed ast and match it", () => {
      expect(
        match(parse("screen and (min-width: 767px) and (max-width: 979px)"), {
          width: 800,
          type: "screen",
        }),
      ).toBe(true)
    })
  })
})
