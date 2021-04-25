/* Module for maps application */
/*global google */
/*global ko */
/*global InfoBubble*/
/*global lscache */
/*global Offline */
/*global dropDownControl */
/*global DropDownOptionsDiv */
/*global OptionDiv */
/*global clearDropDown*/

/*
Internet connection is handled by the offline.js plugin.
http://github.hubspot.com/offline/

Offlinejs monitors the connection after startup and creates a
big down-slide error window if connection is lost.

It is configured to not attempt any automatic reload on reconnect.
Just tells the user to try again after connection succeeds.
*/
Offline.options.reconnect = false;

/*
Global variables to use in google maps to make
infobubbles stay an OK size. Used later in placeMarker()
and in searchFoursquare().
*/
var windowWidth = $(window).innerWidth();
var windowHeight = $(window).innerHeight();
var landscape = (windowWidth > windowHeight) ? true : false;

/*
The local storage is handled by the plugin lscache.js from
https://github.com/pamelafox/lscache
It allows for an expiration time be included with each storage.
Data from each API is cached with different expiration times based
on how likely new data may be available.

For example, the NY Times may get new articles hourly, while wikipedia
information should be quite stable.
*/

/*
Store the windowWidth and windowHeight for searchFoursquare() so it can decide
if new photos of a different size need to be fetched.
This might happen if user turns their phone or tablet from portrait
to landscape or vice versa.
*/
var cachedWindowWidth = parseInt(lscache.get('cachedWindowWidth'));
lscache.set('cachedWindowWidth', windowWidth);
var cachedWindowHeight = parseInt(lscache.get('cachedWindowHeight'));
lscache.set('cachedWindowHeight', windowHeight);

/*
 viewCat - Model for Museum Categories
 */

var viewCat = [{
    isSelected: ko.observable(false),
    category: "encyclopedic",
    name: "Encyclopedic",
    fullname: "Encyclopedic Art Museum",
    description: "Promoting an appreciation of the arts and intellectual inquiry."
}, {
    isSelected: ko.observable(false),
    category: "modern",
    name: "Modern",
    fullname: "Modern Art Museum",
    description: "Offering works by avant-garde artists such as Picasso and Pollock."
}, {
    isSelected: ko.observable(false),
    category: "european",
    name: "European",
    fullname: "European Art Museum",
    description: "Presenting works by European artists."
}, {
    isSelected: ko.observable(false),
    category: "photography",
    name: "Photography",
    fullname: "Photography Art Museum",
    description: "Specializing in photographic and visual culture."
}, {
    isSelected: ko.observable(false),
    category: "design",
    name: "Design",
    fullname: "Design Museum",
    description: "Presenting works of historic and contemporary design."
}];

/*
  viewModel -
  It holds:
  Model Data:
   1) items: array of Museum data from API
      (see database-work/museums.json )

      added to that is the -
      Marker Data:
         As a marker is created, its object, state, and the object of its click
         event handler are stored with each item:
         1) marker - object
         2) clickMarker - its click handler
         3) isVisible - flag to control if it is visible
         4) isSelected - flag to control which one has its infobubble opened
            and its name highlighted in the list.
   2) filter - string holding user typed search
   3) listByCategory - string holding category search
   4) selectedCategory - controls list title on view
   5) filterOnName - toggle for list display in index.html

 Map Data:
   1) openWindow - saved object of the opened infobubble
   2) mapBounds - google object from which the map is centered
   3) resetMap - function for setting map to original configuration

 Cached Data:
   1) cachedModel - items to/from local storage as if it came from the Custom API.

 NOTE: items from above is a ko.observableArray because that is the way ko.mapping returns
 the json data that is retrieved from the custom API.

 */
var viewModel = {
    // main data as an array called items
    items: ko.observableArray([]),
    // cached items
    cachedModel: null,
    // KO observables for search
    filter: ko.observable(""),
    listByCategory: ko.observable(""),
    selectedCategory: ko.observable(""),
    filterOnName: ko.observable(true),

    // state information concerning map
    openWindow: null,
    mapBounds: null,
    /*
      Methods
    */
    //
    getOpenWindow: function () {
        return this.openWindow;
    },
    setOpenWindow: function (window) {
        this.openWindow = window;
    },
    getCachedModel: function () {
        return this.cachedModel;
    },
    setCachedModel: function (cache) {
        this.cachedModel = cache;
    },
    getMapBounds: function () {
        return this.mapBounds;
    },
    setMapBounds: function (bounds) {
        this.mapBounds = bounds;
    },
    // Search museums by category and return an array of Museum names.
    // This need not be an autocomplete because it is not based on typed input.
    filteredItemsByCat: ko.computed({
        read: function () {
            viewModel.filterOnName(false);
            var filter = viewModel.listByCategory().toLowerCase();
            if (!filter || filter === "") {
                return viewModel.items();
            } else {
                return ko.utils.arrayFilter(viewModel.items(), function (item) {
                    return (item.category().toLowerCase() === filter);
                });
            }
        },
        deferEvaluation: true
    }),

    // Return the fullname for the selected museum category.
    // Makes for better labels
    categoryListTitle: ko.computed({
        read: function () {
            var cat = viewModel.selectedCategory().toLowerCase();
            var title;
            for (var i = 0; i < viewCat.length; i++) {
                if (cat === viewCat[i].category.toLowerCase()) {
                    title = viewCat[i].fullname;
                    break;
                }
            }
            return title;
        },
        deferEvaluation: true

    }),
    // Turn off all marker selections
    resetSelected: function () {
        for (var i = 0; i < viewModel.items().length; i++) {
            viewModel.items()[i].isSelected(false);
        }
    },
    // Turn on a marker selection based on museum name
    setSelected: function (name) {
        for (var i = 0; i < viewModel.items().length; i++) {
            if (viewModel.items()[i].name() === name) {
                viewModel.items()[i].isSelected(true);
            }
        }
    },
    // Set those markers visible that match the category
    showMarkersByCategory: function (cat) {
        for (var i = 0; i < viewModel.items().length; i++) {
            viewModel.items()[i].marker.setVisible(true);
            if (cat !== "all") {
                if (viewModel.items()[i].category() !== cat) {
                    viewModel.items()[i].marker.setVisible(false);
                }
            }
        }
    },
};
// Autocomplete search on Museum name.
// This searches on each keystroke input &
// returns an array of matches.
//
// As the user types more of the search, the filter string increases and
// the returned array becomes more specific.
viewModel.filteredItems = ko.computed({
    read: function () {
        viewModel.filterOnName(true);
        var filter = viewModel.filter().toLowerCase();
        if (!filter || filter === "") {
            return viewModel.items();
        } else {
            //ko.utils.arrayFilter - filter the items using the filter text
            return ko.utils.arrayFilter(viewModel.items(), function (item) {
                return (item.name().toLowerCase().indexOf(filter) > -1);
            });
        }
    },
    deferEvaluation: true
});
/*
  KO Subscription for additional actions on filter
  Show only those markers whose names are matching the search
*/
viewModel.filter.subscribe(function (newValue) {
    viewModel.resetMap(true);
    if (typeof newValue === "string") {
        newValue = newValue.toLowerCase();
        for (var i = 0; i < viewModel.items().length; i++) {
            if (viewModel.items()[i].name().toLowerCase().indexOf(newValue) > -1) {
                viewModel.items()[i].marker.setVisible(true);
            } else {
                viewModel.items()[i].marker.setVisible(false);
            }
        }
    }
});

// Event handler for click on name in museum list
var listApp = function () {
    var self = this;

    self.clickList = function () {
        viewModel.resetSelected();
        this.isSelected('true');
        this.clickMarker();
    };

};

/*
  Load Model From Custom API.
  NOTE: see database-work/museums.json, database-work/museums.sql and database-work/api.php
  to see how this API works.

  This simple API does not have a lot of bells and whistles, so a timeout is added in case
  it refuses to return. My cynthiateeters.com server is not fast, so give the timeout a few
  seconds to do its job. If the alert popup occurs, the data may still load after the alert
  is dismissed.

  NOTE: IF THE DATA CANNOT BE LOADED FROM THE CACHE OR THE API CALL, THEN THE APPLICATION CANNOT RUN.
*/

var loadViewModel = function () {

    // check local storage to see if cached
    var myCachedModel = lscache.get('cachedModel');

    if (myCachedModel === null) {
        // not cached: make API call to get viewModel
        var settingsMyAPI = {
            "async": true,
            "crossDomain": true,
            "dataType": "json",
            "url": "http://www.cynthiateeters.com/api.php/museums",
            "method": "GET"
        };

        var modelRequestTimeout = setTimeout(function () {
            alert("Sorry, map resources may have failed or are loading slowly. Please try again later or contact developer for assistance.");
        }, 3000);

        $.ajax(settingsMyAPI)
            .done(function (response, textStatus) {
                viewModel.items = ko.mapping.fromJS(response);
                clearTimeout(modelRequestTimeout);
                lscache.set('cachedModel', response, 2);
                mapApp();

            })
            .fail(function (jqXHR, textStatus, errorThrown) {
                console.log(textStatus, errorThrown);
                alert('Something went terribly wrong. Please contact developer for assistance. ');
                clearTimeout(modelRequestTimeout);
            });

        return null;

    } else {
        // is cached, copy cached data into viewModel
        viewModel.setCachedModel(myCachedModel);
        viewModel.items = ko.mapping.fromJS(myCachedModel);
        mapApp();
        return myCachedModel;
    }

};

/*
  Third Party API section
*/

/*
searchNYT: Makes an API call to retrieve NY Times articles in which the museum
has been tagged.

NOTE: This NY Times search uses their Semantic API, which is the perfect API
for getting news articles about NYC museums. Since, the NYT has tagged the article
with the museum's name, it is very specific.

http://developer.nytimes.com/docs/semantic_api

UNFORTUNATELY, the Semantic API neither allows for cross-origin HTTP request
nor jsonp calls. See my requests for help on this issue:

http://developer.nytimes.com/profile/1724488

To get around this constraint, my wrapper API caller at
http://www.cynthiateeters.com/nytapi.php on my server takes the request and
passes it on to the NYT Semantic API. Hence, no cross-origin problems as I have
configured the server to allow for CORS:
https://developer.mozilla.org/en-US/docs/Web/HTTP/Access_control_CORS

See: database-work/nytapi.php and database-work/nytapi-sample-output.json

If the call succeeds, the returned json data is constructed into an html string that is put
into the right infobubble tab as indentified by the tab's index.

If everything goes well, the whole html string is cached with an expiration time
so the API call does not have to be repeated until its cache expires.
*/
var searchNYT = function (infoBubble, index, name, title) {
    var secret = 'secret=mglcthb34pk8uq9qy53nc4f40uu0ezkj';
    var query = encodeURIComponent(name.trim());
    var cacheIndex = 'cachedNews' + query;
    var cachedNews = lscache.get(cacheIndex);

    var htmlStr = "Attempting to retrieve information from the New York Times.";

    if (cachedNews === null) {
        var uri = 'http://www.cynthiateeters.com/nytapi.php?' + secret + '&search=' + query;

        infoBubble.updateTab(index, title, htmlStr);
        var settings = {
            "async": true,
            "crossDomain": true,
            "dataType": "json",
            "url": uri,
            "method": "GET"
        };

        $.ajax(settings)
            .done(function (response) {
                if (response.num_results > 0) {
                    htmlStr = '<div class="infoBubbleStyle"><br><strong>Recent New York Times Articles</strong><br>';
                    htmlStr += '<a href="http://nytimes.com"  target="_blank">' +
                        '<img src="images/poweredby_nytimes_150b.png" ' +
                        'alt="NYT API Logo" height="30" width="150"></a><br><hr>';
                    var results = response.results[0].article_list.results;

                    var result, dt;
                    for (var i in results) {

                        result = results[i];
                        dt = new Date(result.date);
                        htmlStr += '<p><a href="' + result.url + '" target="_blank">' +
                            result.title + '</a><br/>' + result.byline +
                            '<span> (' + dt + ')</span></p>';

                    }
                    htmlStr += '</div';
                    lscache.set(cacheIndex, htmlStr, 2);
                } else {
                    htmlStr = "Error retrieving data from NY Times.";
                }
                infoBubble.updateTab(index, title, htmlStr);

            })
            .fail(function (jqXHR, textStatus, errorThrown) {
                console.log(textStatus, errorThrown);
                infoBubble.updateTab(index, title, "Got an error retrieving NY Times data.");
            });
    } else {
        infoBubble.updateTab(index, title, cachedNews);
    }
};

/*
 searchWiki: This query is constructed so only the first introductory paragraph
 is returned.

 If the call succeeds, the returned json data is constructed into an html string that is put
 into the right infobubble tab as indentified by the tab's index.

 If everything goes well, the whole html string is cached with an expiration time
 so the API call does not have to be repeated until its cache expires.
*/
var searchWiki = function (infoBubble, index, name, title) {
    var query = encodeURIComponent(name.trim());
    var cacheIndex = 'cachedWiki' + query;
    var cachedWiki = lscache.get(cacheIndex);

    var htmlStr = "Attempting to retrieve information from Wikipedia.";
    infoBubble.updateTab(index, title, htmlStr);

    if (cachedWiki === null) {

        /*
         */
        var searchString = 'https://en.wikipedia.org/w/api.php?format=json' +
            '&action=query&prop=extracts&exintro=&explaintext=&indexpageids=&titles=' +
            query;
        var settings = {
            "async": true,
            "dataType": "jsonp",
            "jsonp": "callback",
            "url": searchString,
            "method": "GET"
        };

        $.ajax(settings)
            .done(function (response) {
                var pageid = response.query.pageids[0];
                var extract = response.query.pages[pageid].extract;
                htmlStr = '<div class="infoBubbleStyle"><br>This introductory information about the ' +
                    name.replace(/_/g, ' ') +
                    ' is provided by Wikipedia. It\'s full page can be found ' +
                    '<a href="https://en.wikipedia.org/?curid=' +
                    pageid + '"  target="_blank">here.</a>';
                htmlStr += '<hr>' + extract;
                htmlStr += '</div><br><br>';
                infoBubble.updateTab(index, title, htmlStr);
                lscache.set(cacheIndex, htmlStr, 2);
            })
            .fail(function (jqXHR, textStatus, errorThrown) {
                console.log(textStatus, errorThrown);
                infoBubble.updateTab(index, title, "Got an retrieving Wikipedia data.");
            });
    } else {
        infoBubble.updateTab(index, title, cachedWiki);
    }

};

/*
searchFoursquare: The Foursquare API is quite complex. Every business in its
database comes with a venue ID, which uniquely identifies that entity. By storing
each museum's venue ID in the model database, a query can be constructed to directly
get photos (as posted by Foursquare members) tagged with that museum.

If the API call succeeds, the returned json data is constructed into an html string that is put
into the right infobubble tab as indentified by the tab's index.

If everything goes well, the whole html string is cached with an expiration time
so the API call does not have to be repeated until its cache expires.

Exception to the above rule:
The size of the photos is controlled by the windowWidth of the screen. Smaller
devices need smaller sized photos so the infobubble size manageable.

If the screen size is changed after the cached html string
was saved, the cache is replaced by a new query to Foursquare.
*/
var searchFoursquare = function (infoBubble, index, venue, title) {
    var query = encodeURIComponent(venue.trim());
    var cacheIndex = 'cachedFoursquare' + query;
    var cachedFoursquare = lscache.get(cacheIndex);
    var htmlStr = "Attempting to retrieve photos from Foursquare.";
    infoBubble.updateTab(index, title, htmlStr);

    if (cachedFoursquare === null || cachedWindowWidth !== windowWidth || cachedWindowHeight !== windowHeight) {
        var queryPrefix = "https://api.foursquare.com/v2/venues/";
        var querySuffix1 = "/photos?&client_id=PUT_YOUR_ID_HERE";
        var querySuffix2 = "&client_secret=PUT_YOUR_SECRET_HERE";
        var searchString = queryPrefix + query + querySuffix1 + querySuffix2;

        var code, count, photo, prefix, suffix, url, original, img;

        var settings = {
            "async": true,
            "dataType": "jsonp",
            "jsonp": "callback",
            "url": searchString,
            "method": "GET"
        };

        $.ajax(settings).done(function (results) {
                var myWidth = "600";
                if (windowWidth <= 1024) {
                    myWidth = "500";
                }
                if (windowWidth <= 800) {
                    myWidth = "400";
                }
                if (windowWidth <= 600) {
                    myWidth = "320";
                }
                if (windowWidth <= 480) {
                    myWidth = "280";
                }
                if (windowWidth <= 360) {
                    myWidth = "200";
                }

                code = results.meta.code;
                if (code === 200) {
                    htmlStr = '<div class="infoBubbleStyle"><br><a href="http://foursquare.com"  target="_blank"> ' +
                        '<img src="images/foursquare_appicon_36.png" alt="Foursquare Logo">' +
                        ' &nbsp;Photos Provided By Foursquare.</a><br><hr>';
                    htmlStr += '<p>Click each thumbnail for a full size image.</p>';
                    count = results.response.photos.count;
                    count = (count >= 20) ? 20 : count;

                    for (var i = 0; i < count; i++) {
                        if (results.response.photos.items[i].visibility === "public") {
                            prefix = results.response.photos.items[i].prefix;
                            suffix = results.response.photos.items[i].suffix;
                            url = prefix + 'width' + myWidth + suffix;
                            original = prefix + "original" + suffix;
                            img = '<img src="' + url + '" alt="Foursquare photo" width="' +
                                myWidth + '">';
                            htmlStr += '<a href="' + original + '"  target="_blank">' +
                                img + '</a><br><hr>';
                        } else {

                        }
                    }
                    lscache.set(cacheIndex, htmlStr, 2);
                } else {
                    htmlStr = "Error retrieving data from Foursquare.";
                }
                htmlStr += '</div>';
                infoBubble.updateTab(index, title, htmlStr);
            })
            .fail(function (jqXHR, textStatus, errorThrown) {
                var errMsg = "Received an error attempting to retrieve Foursquare photos.";
                console.log(textStatus, errorThrown);
                infoBubble.updateTab(index, title, errMsg);
            });
    } else {
        infoBubble.updateTab(index, title, cachedFoursquare);
    }
};
/*
  End of Third Party API section
*/

/*
mapApp - the main function for creating and maintaining the google map.

The map is created with custom control buttons that
allow the user to select museums by category. These control buttons are used
instead of regular html buttons because, by being part of the map, they
conserve screen real estate, especially for small devices like the iphone4.

Google Map API Controls:
https://developers.google.com/maps/documentation/javascript/controls

A "Reset Map" custom control is also provided that puts everything back
to the initial configuration.

The map is extensively styled to look really nice and special.
https://developers.google.com/maps/documentation/javascript/styling?hl=en

The map is centered not on a single latitude and longitiude but on the bounds of
all of the museums' latitudes and longitudes. Based on these values, googlemaps
decides the appropriate center and zoom.

Custom marker icons representing each museum's category are used. The icon
images for these categories are found in the images folder.

Each marker has its own infobubble which will open when either the marker or
its name in the list is clicked.

https://github.com/googlemaps/js-info-bubble

For each museum, its category icon is shown in the first tab
of the museum's infobubble with a description of what that category means.

Only one infobubble is allowed to be open at any one time.

The positioning of the infobubble was seriously problematic for a responsive design,
so a modified version (Anubhav Gupta's solution) is being used.

See:
http://stackoverflow.com/a/15492333

This, still feels very kludgy with fudge factors found from trial and error.

*/
function mapApp() {

    var self = this;

    /* the map */
    var map;
    var mapZoom = 12;
    var ZOOM_IN = 16;

    /*  central location of Manhattan, New York City*/
    // MOMA 40.761396839011994, -73.976985749303760
    // MET 40.778936659294864, -73.962298200076250
    // Guggenheim 40.78295829462048, -73.95910263061523

    /**
     * Adds a "Reset Map" control to the map
     * This constructor takes the control DIV as an argument.
     */
    var customControlTitle = function (controlDiv, map) {

        // Set CSS for the control border of Reset Button.
        var controlUI = document.createElement('div');
        controlUI.style.backgroundColor = 'rgba(255,255,255, 0.75)';
        controlUI.style.cursor = 'text';
        controlUI.style.borderRadius = '5px';
        controlUI.style.marginLeft = '1rem';
        controlUI.style.marginRight = '1rem';
        //controlUI.style.paddingBottom = '1rem';
        //controlUI.style.paddingRight = '1rem';
        controlUI.style.padding = '0.5rem';
        if (windowWidth <= 360) {
            controlUI.style.paddingRight = '0.5rem';
        }

        controlUI.style.textAlign = 'center';
        //controlUI.title = '';
        controlDiv.appendChild(controlUI);

        // Set CSS for the control interior of Reset Button.
        var controlText = document.createElement('div');
        controlText.style.color = 'red';
        controlText.style.fontFamily = 'Playfair Display,serif';
        controlText.style.fontSize = '1rem';
        controlText.style.fontWeight = '700';
        controlText.style.fontStyle = 'italic';

        controlText.style.lineHeight = '1.5rem';

        if (windowWidth <= 598) {

            controlText.style.letterSpacing = '0.2rem';
        }
        if (windowWidth >= 768) {
            controlText.style.fontSize = '2rem';
            controlText.style.lineHeight = '2rem';
            controlText.style.letterSpacing = '0.4rem';
            controlText.style.fontWeight = '700';
        }
        controlText.innerHTML = 'Manhattan<br>Art Museums';
        controlUI.appendChild(controlText);
    };

    /**
     * Adds a "Reset Map" control to the map
     * This constructor takes the control DIV as an argument.
     */
    var customControlResetMap = function (controlDiv, map) {

        // Set CSS for the control border.
        var controlUI = document.createElement('div');
        controlUI.style.backgroundColor = '#fff';
        controlUI.style.border = '2px solid #fff';
        controlUI.style.borderRadius = '5px';
        controlUI.style.boxShadow = '0 2px 6px rgba(0,0,0,.3)';
        controlUI.style.cursor = 'pointer';
        controlUI.style.marginTop = '0.2rem';
        controlUI.style.marginLeft = '0.5rem';
        controlUI.style.paddingTop = '0.8rem';
        controlUI.style.paddingBottom = '0.8rem';
        controlUI.style.paddingLeft = '0.2rem';
        controlUI.style.paddingRight = '0.2rem';

        controlUI.style.textAlign = 'center';
        controlUI.title = 'Click to select a museum category';
        controlDiv.appendChild(controlUI);

        // Set CSS for the control interior.
        var controlText = document.createElement('div');
        controlText.style.color = 'red';
        controlText.style.fontFamily = 'Lato,sans-serif';
        controlText.style.fontSize = '1rem';
        controlText.style.lineHeight = '1.5rem';
        if (windowWidth >= 768) {
            controlText.style.fontSize = '1.5rem';
            controlText.style.lineHeight = '2rem';
        }
        if (windowWidth >= 1024) {
            controlText.style.fontSize = '1.5rem';
            controlText.style.lineHeight = '2rem';
        }
        controlText.innerHTML = 'Reset Map';
        controlUI.appendChild(controlText);

        // Setup the click event listeners
        controlUI.addEventListener('click', function () {
            resetMap();
            viewModel.showMarkersByCategory("all");
        });
    };

    /**
     * Adds Museum Category control to the map
     * This constructor takes the control DIV as an argument.
     */
    var customControlCategory = function (controlDiv, map, catObj) {

        var label = catObj.name;
        /*
        if (windowWidth >= 800) {
            label = catObj.fullname;
        }
        */

        // Set CSS for the control border.
        var controlUI = document.createElement('div');
        controlUI.style.backgroundColor = '#fff';
        controlUI.style.border = '2px solid #fff';
        controlUI.style.borderRadius = '3px';
        controlUI.style.boxShadow = '0 2px 6px rgba(0,0,0,.3)';
        controlUI.style.cursor = 'pointer';
        controlUI.style.marginTop = '0.2rem';
        controlUI.style.marginRight = '0.2rem';
        controlUI.style.paddingTop = '0.6rem';
        controlUI.style.paddingBottom = '0.6rem';
        controlUI.style.paddingLeft = '0.2rem';
        controlUI.style.paddingRight = '0.2rem';

        controlUI.style.textAlign = 'center';
        controlUI.title = 'Click to select a museum category';
        controlDiv.appendChild(controlUI);

        // Set CSS for the control interior.
        var controlText = document.createElement('div');
        controlText.style.color = 'red';
        controlText.style.fontFamily = 'Lato,sans-serif';
        controlText.style.fontSize = '1rem';
        controlText.style.lineHeight = '1.5rem';
        if (windowWidth >= 768) {
            controlText.style.fontSize = '1.5rem';
            controlText.style.lineHeight = '2rem';
        }
        if (windowWidth >= 1024) {
            controlText.style.fontSize = '1.5rem';
            controlText.style.lineHeight = '2rem';
        }
        controlText.innerHTML = label;
        controlUI.appendChild(controlText);

        // Setup the click event listeners
        controlUI.addEventListener('click', function () {
            resetMap();
            viewModel.filter("");
            viewModel.filterOnName(false);
            viewModel.showMarkersByCategory(catObj.category);
            viewModel.listByCategory(catObj.category);
            viewModel.selectedCategory(catObj.category);
        });
    };

    var customControlDropdown = function () {

        var divOptions, optionDivSet = [];
        for (var i = 0; i < viewCat.length; i++) {
            //start process to set up custom drop down
            //create the options that respond to click
            divOptions = {
                gmap: map,
                name: viewCat[i].name,
                title: viewCat[i].name,
                id: viewCat[i].name
            };
            //console.log(divOptions);
            optionDivSet[i] = new OptionDiv(divOptions);

        }

        //put them all together to create the drop down
        var ddDivOptions = {
            items: optionDivSet,
            id: "myddOptsDiv"
        };
        var dropDownDiv = new DropDownOptionsDiv(ddDivOptions);

        var dropDownOptions = {
            gmap: map,
            name: 'Categories',
            id: 'ddControl',
            title: 'A custom drop down select',
            position: google.maps.ControlPosition.TOP_LEFT,
            dropDown: dropDownDiv
        };

        var dropDownControl1 = new dropDownControl(dropDownOptions);
    };
    /*
    Create the map.

    No need to give it a position because we will use the
    markers' latitudes and longitudes to establish the bounds of the map.
    The map is then fit to these bounds.

    https://developers.google.com/maps/documentation/javascript/reference?hl=en

    Remove the standard map controls except for the zoomControl.

    */
    var createMap = function () {

        map = new google.maps.Map(document.getElementById('mapContainer'), {
            draggable: true,
            zoom: mapZoom,
            disableDefaultUI: false,
            mapTypeControl: false,
            mapTypeControlOptions: {
                style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
                position: google.maps.ControlPosition.TOP_CENTER
            },
            zoomControl: true,
            zoomControlOptions: {
                position: google.maps.ControlPosition.RIGHT_CENTER
            },
            scaleControl: true,
            streetViewControl: false,
            streetViewControlOptions: {
                position: google.maps.ControlPosition.LEFT_TOP
            }
        });
        styleMap();

        /*
        Now create the custom controls.
        */
        // Create the "Reset Map" button:
        // Create the DIV to hold the control and call the constructor
        // passing in this DIV.
        var centerControlDiv = document.createElement('div');
        customControlResetMap(centerControlDiv, map);
        centerControlDiv.index = 1;
        if (landscape && windowHeight < 480) {
            map.controls[google.maps.ControlPosition.TOP_RIGHT].push(centerControlDiv);
        } else {
            map.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(centerControlDiv);
        }

        // Create the Title as a button:
        // Create the DIV to hold the control and call the constructor
        // passing in this DIV.

        centerControlDiv = document.createElement('div');
        customControlTitle(centerControlDiv, map);
        centerControlDiv.index = 2;
        if (landscape && windowWidth > 600) {
            map.controls[google.maps.ControlPosition.TOP_CENTER].push(centerControlDiv);
        } else {
            map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(centerControlDiv);
        }

        // Create the Museum Category buttons:
        // Create the DIV to hold the control and call the constructor
        // passing in this DIV.
        /*
        for (var i = 0; i < viewCat.length; i++) {
            centerControlDiv = document.createElement('div');
            customControlCategory(centerControlDiv, map, viewCat[i]);
            centerControlDiv.index = i + 3;
            map.controls[google.maps.ControlPosition.TOP_CENTER].push(centerControlDiv);

        }
        */
        customControlDropdown();
    };

    /*
    Basic map is now constructed and styled. Let's get the markers on it
    and create the infobubbles.
    */

    /*
    Helper function for formatting first infobubble tab that holds museum's
    contact information.
    */
    var formatContentString = function (itemObj) {

        var contentString = '<div class="infoBubbleStyle"><br>' +
            '<div itemscope itemtype="http://schema.org/Organization">' +
            '<div itemprop="address" itemscope itemtype="http://schema.org/PostalAddress">' +
            '<span itemprop="name">' + itemObj.name() + '</span>' +
            '<span itemprop="streetAddress">' + itemObj.streetAddress() + '</span>' +
            '<span itemprop="addressLocality">' + itemObj.addressLocality() + '</span>' +
            '<span itemprop="addressRegion">' + itemObj.addressRegion() + '</span>' +
            '<span itemprop="postalCode">' + itemObj.postalCode() + '</span>' +
            '</div><br>Phone: ' +
            '<span itemprop="telephone">' + itemObj.telephone() + '</span>' +
            'URL: <a href="' + itemObj.website() +
            '" itemprop="url" target="_blank">' + itemObj.name() + '</a>' +
            '</div>' + '<br><img src="images/' + itemObj.category() + '.png" >';

        for (var i = 0; i < viewCat.length; i++) {
            if (viewCat[i].category === itemObj.category()) {
                contentString += '<span>' + viewCat[i].fullname + ' - ' +
                    viewCat[i].description + '</span>';
                break;
            }
        }
        contentString += "</div>";
        return contentString;
    };

    /*
    Place a marker on the map and create its infobubble.

    NOTE: The infobubble's size and placement is sensitive to the screen size
    of the map. We use the global variables windowWidth and windowHeight to
    make sure the infobubble stays inside the viewport.
    */
    var placeMarker = function (itemObj) {
        var latlng = new google.maps.LatLng(itemObj.lat(), itemObj.lng());

        // Use a custom marker icon
        var iconURL = 'images/' + itemObj.category() + '.png';

        // create and place a "dropping" marker on the map
        var marker = new google.maps.Marker({
            position: latlng,
            map: map,
            animation: google.maps.Animation.DROP,
            icon: iconURL,
            title: name
        });

        // calculate anacceptable size for the infobubble & create it
        var myMaxWidth = windowWidth * 0.25;
        var myMaxHeight = windowHeight * 0.4;
        if (windowWidth >= 360) {
            myMaxWidth = windowWidth * 0.6;
        }
        if (windowWidth >= 1280) {
            myMaxWidth = windowWidth * 0.4;
        }
        if (windowHeight < 360) {
            myMaxHeight = windowHeight * 0.35;
        }

        var infoBubble = new InfoBubble({
            map: map,
            position: marker.getPosition(),
            borderRadius: 0,
            arrowStyle: 1,
            shadowStyle: 0,
            arrowPosition: 90,
            arrowSize: 0,
            minWidth: 200,
            maxWidth: myMaxWidth,
            minHeight: myMaxHeight,
            maxHeight: myMaxHeight,
            zIndex: 999
        });

        // calculate an acceptable position for the infobubble
        var xOff = 250;
        if (landscape) {
            xOff = 250;
        }
        var yOff = -60;
        if (landscape) {
            yOff = -1;
        }

        var offsetX = xOff * windowWidth / 1024;
        var offsetY = yOff * windowWidth / 768;
        if (windowWidth >= 1024) {
            offsetY = 2 * offsetY;
        }
        infoBubble.setBubbleOffset(offsetX, offsetY);

        /*
        After creation, load infobubble with information specific to that museum
        To do that, we call the NYT, WIKI, and FOURSQUARE APIs.
        */

        /*
        Create labels for tabs
        */
        var myAddress = '<span class="infoBubbleLabel">Address</span>';
        var myInfo = '<span class="infoBubbleLabel">Wiki</span>';
        var myNews = '<span class="infoBubbleLabel">News</span>';
        var myPhotos = '<span class="infoBubbleLabel">Photos</span>';

        /*
        For small devices, use font icons instead of text labels
        */
        if (myMaxWidth < 125) {
            myAddress = '<span class="infoBubbleLabel"><i class="fa fa-street-view fa-fw fa-red"></i></span>';
            myInfo = '<span class="infoBubbleLabel"><i class="fa fa-info-circle fa-fw  fa-red"></i></span>';
            myNews = '<span class="infoBubbleLabel"><i class="fa fa-newspaper-o fa-fw  fa-red"></i></span>';
            myPhotos = '<span class="infoBubbleLabel"><i class="fa fa-photo fa-fw fa-red"></i></span>';
        }

        /*
        First infobubble tab: Contact Information
        */
        var contentString = formatContentString(itemObj);
        infoBubble.addTab(myAddress, contentString); // index = 0

        /*
        Second infobubble tab: Wikipedia information
        */
        infoBubble.addTab(myInfo, ''); // index = 1
        searchWiki(infoBubble, 1, itemObj.searchWiki(), myInfo);

        /*
        Third infobubble tab: NY Times articles
        */
        infoBubble.addTab(myNews, ''); // index = 2
        searchNYT(infoBubble, 2, itemObj.searchNYT(), myNews);

        /*
        Fourth infobubble tab: Foursquare photos
        */
        infoBubble.addTab(myPhotos, ''); // index = 3
        searchFoursquare(infoBubble, 3, itemObj.search4Square(), myPhotos);

        /*
        Event Handlers and Listeners for marker click and infobubble closeclick.
        */

        function clickMarker() {
            clearDropDown();
            if (viewModel.getOpenWindow()) {
                viewModel.getOpenWindow().close();
            }
            marker.setVisible(true);
            marker.setAnimation(google.maps.Animation.BOUNCE);
            setTimeout(function () {
                marker.setAnimation(null);
            }, 4200);
            infoBubble.open(map, marker);
            viewModel.setOpenWindow(infoBubble);
            viewModel.resetSelected();
            viewModel.setSelected(name);
            itemObj.isSelected(true);
        }
        //
        marker.addListener('click', clickMarker);
        google.maps.event.addListener(infoBubble, 'closeclick', resetMap);

        /*
        Extend the map's bounds to include this marker's latlng location
        */
        var offsetLat = parseFloat(itemObj.lat());
        var offsetLng = parseFloat(itemObj.lng());
        var extendlatlng = new google.maps.LatLng(offsetLat, offsetLng);

        viewModel.getMapBounds().extend(extendlatlng);

        // If lanscape, offset the latitude plus and minus for better centering
        // (allows more room on map for control buttons)
        if (landscape) {
            extendlatlng = new google.maps.LatLng(offsetLat + 0.015, offsetLng);
            viewModel.getMapBounds().extend(extendlatlng);

        } else {
            extendlatlng = new google.maps.LatLng(offsetLat - 0.005, offsetLng);
            viewModel.getMapBounds().extend(extendlatlng);
            extendlatlng = new google.maps.LatLng(offsetLat + 0.015, offsetLng);
            viewModel.getMapBounds().extend(extendlatlng);

        }

        /*
        Add marker state to viewModel items for later access
        */
        itemObj.isSelected = ko.observable(false);
        itemObj.marker = marker;
        itemObj.clickMarker = clickMarker;

        return {
            "marker": marker,
            "clickMarker": clickMarker
        };
    }; // end placeMarker()

    /*
    Method to get the map back to its original configuration
    */
    var resetMap = function (beingFiltered) {
        clearDropDown();
        if (!beingFiltered) {
            //reset the filter
            viewModel.filter("");
        }
        viewModel.filterOnName(true);
        viewModel.resetSelected();
        if (viewModel.getOpenWindow()) {
            viewModel.getOpenWindow().close();
            viewModel.setOpenWindow(null);
        }

        for (var i = 0; i < viewModel.items().length; i++) {
            viewModel.items()[i].marker.setVisible(true);
            viewModel.items()[i].marker.setAnimation(null);
        }
        map.fitBounds(viewModel.getMapBounds());
    };

    /*
    Method to style the map. Color it and remove featuretypes
    to make it simpler.
    */
    var styleMap = function () {
        var styles = [{
                stylers: [{
                    hue: "#89CFF0"
                }, {
                    saturation: 0
                }]
            }, {
                featureType: "road",
                elementType: "geometry",
                stylers: [{
                    lightness: 100
                }, {
                    visibility: "simplified"
                }]
            }, {
                "featureType": "poi.attraction",
                "elementType": "labels.text",
                "stylers": [{
                    "visibility": "off"
                }]
            }, {
                "featureType": "poi.business",
                "stylers": [{
                    "visibility": "off"
                }]
            }, {
                "featureType": "transit",
                "stylers": [{
                    "visibility": "off"
                }]
            }, {
                "featureType": "transit.line",
                "stylers": [{
                    "visibility": "off"
                }]
            }, {
                "featureType": "transit.station.rail",
                "stylers": [{
                    "visibility": "off"
                }]
            }, {}

        ];
        map.setOptions({
            styles: styles
        });
    };

    /*
    NOTE: The init function should only be called after the both the googlemaps API
    and the Model API have loaded.
    */
    var init = function () {

        /* add code to initialise this module */

        createMap();
        // Create an empty map bounds object
        viewModel.setMapBounds(new google.maps.LatLngBounds());

        // Loop through each viewModel item and set its marker
        // The map's bounds will be extended with each marker
        //
        for (var i = 0; i < viewModel.items().length; i++) {
            placeMarker(viewModel.items()[i]);
        }
        // center and size the map based on its newly created bounds
        map.fitBounds(viewModel.getMapBounds());
        mapZoom = map.getZoom();
    };

    /* execute the init function only when the model is loaded and ready */

    init();
    ko.applyBindings(listApp, document.getElementById('headerContainer'));

    viewModel.resetMap = resetMap;
} // end mapApp

/*
Callback functions for google API async:

https://discussions.udacity.com/t/handling-google-maps-in-async-and-fallback/34282

*/
var googleSuccess = function () {
    if (typeof google !== 'undefined') {

        // the variable is defined
        loadViewModel();
    } else {
        alert("A serious error occurred. Please contact the developer.");
    }
};

var googleError = function () {
    alert("For some reason, Google is not loading its map for us.");
};
