var map, isMapLoaded = false;
var $preConnect = document.getElementById('pre-connect');
var $postConnect = document.getElementById('post-connect');
var $login = document.getElementById('login-foursquare');
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
          lscache.set('allVenues', venues, 60); // 1 hour
        });
      }
    };

    function plotVenues(allVenues){
      if (!isMapLoaded){
        setTimeout(function(){
          plotVenues(allVenues);
        }, 300);
        return;
      }
      var currentInfoWindow = {close: function(){}};
      allVenues.forEach(function(item){
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
            strokeOpacity: .5,
            strokeWeight: 6
          },
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
    };

    getList(function(listID){
      getVenues(0, listID, plotVenues);
    });
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
      strokeOpacity: .5,
      strokeWeight: 6
    },
    map: map,
    title: 'Your current location'
  });

  if (navigator.geolocation){
    navigator.geolocation.getCurrentPosition(function(position){
      var pos = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
      map.setCenter(pos);
    }, function(){
      alert('Oops, unable to get your location :(');
    });

    $currentLocation.hidden = false;
    $currentLocation.addEventListener('click', function(e){
      e.preventDefault();
      map.setCenter(geoMarker.getPosition());
    }, false);

    navigator.geolocation.watchPosition(function(position){
      var pos = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
      geoMarker.setPosition(pos);
    });
  } else {
    alert('Oops, unable to get your location :(');
  }
};
