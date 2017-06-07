var map, isMapLoaded = false;
var $preConnect = document.getElementById('pre-connect');
var $postConnect = document.getElementById('post-connect');
var $login = document.getElementById('login-foursquare');
var $refreshMarkers = document.getElementById('refresh-markers');
var $logout = document.getElementById('logout-foursquare');
var $currentLocation = document.getElementById('current-location');
var $beam = document.getElementById('beam');

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

    function getList(callback){
      var listID = lscache.get('listID');
      if (listID){
        callback(listID);
      } else {
        hello('foursquare').api('users/self/lists', {group: 'yours'}).then(function(data){
          var items = data.response.lists.items;
          var item = items.filter(function(item){return /todo/.test(item.id)})[0];
          if (!item){
            callback();
            return;
          };
          var listID = item.id;
          callback(listID);
          lscache.set('listID', listID, 60); // 1 hour
        });
      }
    };

    var venues = [];
    function getVenues(index, listID, callback){
      var allVenues = lscache.get('allVenues');
      if (allVenues && allVenues.length){
        callback(allVenues);
      } else {
        hello('foursquare').api('lists/' + listID, {
          limit: 200,
          offset: index*200
        }).then(function(d){
          var listItems = d.response.list.listItems;
          venues = venues.concat(listItems.items);
          if (listItems.count > venues.length){
            getVenues(++index, listID, callback);
            return;
          }
          callback(venues);
          lscache.set('allVenues', venues, 24*60); // 24 hours
        });
      }
    };

    var currentInfoWindow = {close: function(){}};
    var placeMarkers = [];

    function drawMarker(item){
      var venue = item.venue;
      var addr = venue.location.formattedAddress;
      var linkAddr = '';
      if (addr && addr.length){
        addr = addr.join(', ');
        linkAddr = '<a class="addr" href="https://www.google.com/maps/dir/Current+Location/' + encodeURIComponent(addr) + '" target="_blank">' + addr + '</a><br>';
      }
      var infoWindow = new google.maps.InfoWindow({
        content: '<div class="info-content">'
          + '<a href="http://foursquare.com/v/' + venue.id + '" target="_blank"><strong>' + venue.name + '</strong></a><br>'
          + linkAddr
          + venue.categories.map(function(cat){ return '<small>' + cat.name + '</small><br>'; })
          + '<a href="foursquare://venues/' + venue.id + '" class="button">Open in App</a>'
          + '</div>'
      });

      var marker = new google.maps.Marker({
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: 'red',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeOpacity: .7,
          strokeWeight: 3,
        },
        position: new google.maps.LatLng(venue.location.lat, venue.location.lng),
        map: map,
        title: venue.name
      });
      placeMarkers.push(marker);
      google.maps.event.addListener(marker, 'click', function() {
        currentInfoWindow.close();
        infoWindow.open(map, marker);
        currentInfoWindow = infoWindow;
      });
    };

    function clearMarkers(){
      placeMarkers.forEach(function(marker){
        marker.setMap(null);
      });
    };

    function plotVenues(allVenues){
      if (!isMapLoaded || !map.getBounds()){
        setTimeout(function(){
          plotVenues(allVenues);
        }, 300);
        return;
      }

      var boundedVenues = [], unboundedVenues = [];
      var bounds = map.getBounds();
      allVenues.forEach(function(item){
        var venue = item.venue;
        var position = new google.maps.LatLng(venue.location.lat, venue.location.lng);
        if (bounds.contains(position)){
          boundedVenues.push(item);
        } else {
          unboundedVenues.push(item);
        }
      });

      boundedVenues.forEach(drawMarker);
      setTimeout(function(){
        unboundedVenues.forEach(drawMarker);
      }, 2000);
    };

    getList(function(listID){
      getVenues(0, listID, plotVenues);
    });

    $refreshMarkers.addEventListener('click', function(){
      clearMarkers();
      lscache.remove('allVenues');
      getList(function(listID){
        getVenues(0, listID, plotVenues);
      });
    }, false);
  })
  .on('auth.logout', function(){
    $preConnect.hidden = false;
    $postConnect.hidden = true;
  });

hello.init({
  foursquare: 'QUJ11EJTNO0PNBLA40QWMSQZCXJMMVP05NJ1NYI0MZ1PB4P3'
});

function initMap(){
  map = new google.maps.Map(document.getElementById('map'), {
    backgroundColor: '#B3D1FF',
    zoom: 16,
    disableDefaultUI: true
  });
  isMapLoaded = true;

  var transitLayer = new google.maps.TransitLayer();
  transitLayer.setMap(map);

  var geoMarker = new google.maps.Marker({
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 6,
      fillColor: '#4B9FF9',
      fillOpacity: 1,
      strokeColor: '#fff',
      strokeOpacity: .7,
      strokeWeight: 3,
    },
    map: map,
    title: 'Your current location'
  });

  var rectangle = new google.maps.Rectangle({
    fillColor: '#000000',
    fillOpacity: 0.3,
    strokeWeight: 0,
    map: map,
    bounds: {
      north: 90,
      east: 180,
      south: -90,
      west: -180,
    },
  });

  if (navigator.geolocation){
    var storedPos = sessionStorage.getItem('fourcircle-current-position');
    if (storedPos){
      var splittedPos = storedPos.split(' ');
      var oldPos = new google.maps.LatLng(splittedPos[0], splittedPos[1]);
      map.setCenter(oldPos);
      geoMarker.setPosition(oldPos);
    }

    navigator.geolocation.getCurrentPosition(function(position){
      var pos = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
      map.setCenter(pos);
      sessionStorage.setItem('fourcircle-current-position', position.coords.latitude + ' ' + position.coords.longitude);

      navigator.geolocation.watchPosition(function(position){
        var pos = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
        geoMarker.setPosition(pos);
        sessionStorage.setItem('fourcircle-current-position', position.coords.latitude + ' ' + position.coords.longitude);
      });
    }, function(){
      alert('Oops, unable to get your location :(');
    });

    $currentLocation.hidden = false;
    $currentLocation.addEventListener('click', function(e){
      e.preventDefault();
      map.setCenter(geoMarker.getPosition());
    }, false);
  } else {
    alert('Oops, unable to get your location :(');
  }
};
