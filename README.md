## Udacity Neighborhood Map: Project 5

This single page app presents a map with custom markers showing art museums located in Manhattan, New York. The user may click on a marker and a window will open. The window contains four tabs with information about that selected museum:

1. Contact information.
2. An introductory paragraph from wikipedia.
3. A list of the most recent NY Times articles featuring that museum.
4. Photographs posted by Foursquare members who have tagged the museum.

The page presents a list of the museums on the right side of the map. A left-to-right slider can move the list out of the way for easier viewing of the map on small devices. The user may either click on the marker or on the museum name to get the info window to open. Once clicked, the marker bounces three times to alert the user and the museum's name in the list is highlighted.

A filter box appears in the header allowing the user to search by the museum's name. As the name is typed, the filter instantly reacts showing those museums that match what is being typed.

The museums are also categorized. To see the museums of a particular category, the user may use the dropdown menu to click on a category name.

### Live Demo

[Manhattan Art Museums](http://cynthiateeters.com/map/)

### Install

1. Download the repository
2. The compiled webapp is in the dist folder
3. Open index.html in a browser


### Build From The Project's Root
    $ npm install
    $ gulp


### Resources

* [knockout.js](http://knockjs.com)
* [Google Maps](https://developers.google.com/maps/?hl=en)
* [jQuery](https://jquery.com/)
* [knockout.js mapping](https://github.com/SteveSanderson/knockout.mapping/tree/master/build/output)
* [offline](http://github.hubspot.com/offline/)
* [lscache](https://github.com/pamelafox/lscache)
* [NY Times Semantic API](http://developer.nytimes.com/docs/semantic_api)
* [Wikipedia API](https://www.mediawiki.org/wiki/API:Main_page)
* [Foursquare API](https://developer.foursquare.com/)
* [Flowtype](http://simplefocus.com/flowtype/)
* [Map icons](https://mapicons.mapsmarker.com/)
* [Creating a Simple REST API in PHP](https://www.leaseweb.com/labs/2015/10/creating-a-simple-rest-api-in-php/)
* [A Google Map Style Drop-Down](http://brianaccomresearch.blogspot.com/2012/03/google-map-style-drop-down.html)
