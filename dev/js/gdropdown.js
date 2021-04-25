/*global google*/
/*global resetMap*/
/*global viewModel*/

/*
Modified from code by Briana Sullivan

http://stackoverflow.com/a/19725966
http://brianaccomresearch.blogspot.com/2012/03/google-map-style-drop-down.html
*/
/************
		 Classes to set up the drop-down control
************/

function OptionDiv(options) {

    var clickCategory = function () {
        var lowerCaseName = options.name.toLowerCase();
        viewModel.resetMap();
        viewModel.filter("");
        viewModel.filterOnName(false);
        viewModel.showMarkersByCategory(lowerCaseName);
        viewModel.listByCategory(lowerCaseName);
        viewModel.selectedCategory(options.name);
    };

    var control = document.createElement('DIV');
    control.className = "dropDownItemDiv";
    control.title = options.title;
    control.id = options.id;
    control.innerHTML = options.name;
    google.maps.event.addDomListener(control, 'click', clickCategory);
    return control;
}

function DropDownOptionsDiv(options) {
    var container = document.createElement('DIV');
    container.className = "dropDownOptionsDiv";
    container.id = options.id;

    for (var i = 0; i < options.items.length; i++) {
        container.appendChild(options.items[i]);
    }
    return container;
}

function dropDownControl(options) {

    var container = document.createElement('DIV');
    container.className = 'container';

    var control = document.createElement('DIV');
    control.className = 'dropDownControl';
    control.innerHTML = '<div>' + options.name +
        '&nbsp;&nbsp;<span><span>&nbsp;&nbsp;<i class="fa fa-arrow-down"></i></div>';
    control.id = options.name;
    container.appendChild(control);
    container.appendChild(options.dropDown);

    options.gmap.controls[options.position].push(container);
    google.maps.event.addDomListener(container, 'click', function () {
        if (document.getElementById('myddOptsDiv').style.display === 'block') {
            document.getElementById('myddOptsDiv').style.display = 'none';
        } else {
            document.getElementById('myddOptsDiv').style.display = 'block';
        }
    });
}

var clearDropDown = function () {
    document.getElementById('myddOptsDiv').style.display = 'none';
};
