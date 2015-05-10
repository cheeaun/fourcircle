var map;
var $preConnect = document.getElementById('pre-connect');
var $postConnect = document.getElementById('post-connect');
var $login = document.getElementById('login-foursquare');
var $logout = document.getElementById('logout-foursquare');
var $currentLocation = document.getElementById('current-location');
var $beam = document.getElementById('beam');

// Bind links to open in native iOS app first
document.body.addEventListener('click', function(e){
  var el = e.target;
  if (el.tagName.toLowerCase() == 'a' && el.dataset.target == 'fsq.venue'){
    e.preventDefault();
    var start = +new Date();
    $beam.src = 'foursquare://venues/' + el.dataset.venue;
    var end = +new Date();
    var elapsed = end - start;
    if (elapsed < 1) window.open(el.href);
  }
}, false);

$login.addEventListener('click', function(){
  hello('foursquare').login({
    display: 'popup'
  });
}, false);

$logout.addEventListener('click', function(){
  hello('foursquare').logout().then(function(){
    location.reload();
  });
}, false);

hello
  .on('auth.login', function(auth){
    $preConnect.hidden = true;
    $postConnect.hidden = false;

    hello('foursquare').api('users/self/lists', {group: 'created'}).then(function(data){
      var items = data.response.lists.items;
      var item = items.filter(function(item){return /todo/.test(item.id)})[0];
      if (!item) return;
      var listID = item.id;

      var venues = [];
      var getVenues = function(index){
        hello('foursquare').api('lists/' + listID, {
          limit: 200,
          offset: index*200
        }).then(function(d){
          var listItems = d.response.list.listItems;
          venues = venues.concat(listItems.items);
          if (listItems.count > venues.length){
            getVenues();
            return;
          }
          var currentInfoWindow = {close: function(){}};
          venues.forEach(function(item){
            var venue = item.venue;
            var infoWindow = new google.maps.InfoWindow({
              content: '<div class="info-content">'
                + '<a href="http://foursquare.com/v/' + venue.id + '" target="_blank" data-target="fsq.venue" data-venue="' + venue.id + '" style="display: block;"><strong>' + venue.name + '</strong></a>'
                + (venue.location.formattedAddress ? (venue.location.formattedAddress.join('<br>') + '<br>') : '')
                + venue.categories.map(function(cat){ return '<small>' + cat.name + '</small>'; })
                + '</div>'
            });

            var marker = new google.maps.Marker({
              position: new google.maps.LatLng(venue.location.lat, venue.location.lng),
              map: map,
              title: venue.name
            });
            google.maps.event.addListener(marker, 'click', function() {
              currentInfoWindow.close();
              infoWindow.open(map, marker);
              currentInfoWindow = infoWindow;
            });
          });
        });
      }
      getVenues(0);
    });
  })
  .on('auth.logout', function(){
    $preConnect.hidden = false;
    $postConnect.hidden = true;
  });

google.maps.event.addDomListener(window, 'load', function(){
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 0, lng: 0},
    zoom: 16,
    disableDefaultUI: true
  });

  var geoMarker = new google.maps.Marker({
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 6,
      fillColor: '#4B9FF9',
      fillOpacity: 1,
      strokeColor: '#fff',
      strokeOpacity: .5,
      strokeWeight: 6
    },
    map: map,
    title: 'Your current location'
  });

  if(navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(position) {
      var pos = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
      map.setCenter(pos);
      hello.init({
        foursquare: 'QUJ11EJTNO0PNBLA40QWMSQZCXJMMVP05NJ1NYI0MZ1PB4P3'
      });
    }, function() {
      alert('Oops, unable to get your location :(');
    });

    $currentLocation.hidden = false;
    $currentLocation.addEventListener('click', function(e){
      e.preventDefault();
      map.setCenter(geoMarker.getPosition());
    }, false);

    navigator.geolocation.watchPosition(function(position) {
      var pos = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
      geoMarker.setPosition(pos);
    });
  } else {
    alert('Oops, unable to get your location :(');
  }
});
