# CSS Media Query 2

[![npm latest package](https://img.shields.io/npm/v/css-mediaquery2/latest.svg)](https://www.npmjs.com/package/css-mediaquery2)
[![bundle size](https://img.shields.io/bundlephobia/minzip/css-mediaquery2.svg)](https://bundlephobia.com/package/css-mediaquery2)

Parses and determines if a given CSS Media Query matches a set of values via
JavaScript.

## Installation

Install via npm:

```bash
npm install css-mediaquery2
```

## Usage

This package has two exports: `parse()`, and `match()` which can parse CSS Media
Queries and determine if a media query matches a given set of values.

### Matching

The `match()` method lets you compare a media query expression with a JavaScript
object and determine if a media query matches a given set of values.

```js
import MediaQuery from "css-mediaquery2"

const matches = MediaQuery.match("screen and (min-width: 40em)", {
  type: "screen",
  width: "1024px",
})
console.log(matches) // => true
```

The values specified to check a media query string against should be thought of
as if they are the current state of a device/browser. A `type` value _must_ be
specified, and it can _not_ be `"all"`.

### Parsing

Existing CSS Parsers don't do a great job at parsing the details of media
queries. That's where `css-mediaquery2` shines. You can parse a media query
expression and get an AST back by using the `parse()` method.

```js
import MediaQuery from "css-mediaquery2"

const ast = MediaQuery.parse("screen and (min-width: 48em)")
```

The `ast` variable will have the following payload:

```js
;[
  {
    inverse: false,
    type: "screen",
    expressions: [
      {
        modifier: "min",
        feature: "width",
        value: "48em",
      },
    ],
  },
]
```

This package was written with care to following the W3C Recommendations for
[CSS3 Media Queries](http://www.w3.org/TR/css3-mediaqueries/) and
[CSS3 Values and Units](http://www.w3.org/TR/css3-values/). It supports all of
the [Media Features](http://www.w3.org/TR/css3-mediaqueries/#media1) and will
properly convert values to a common unit before comparing them.

## License

This software is free to use under the ISC license. See the
[LICENSE file](https://github.com/efoken/css-mediaquery2/blob/main/LICENSE) for
license text and copyright information.
