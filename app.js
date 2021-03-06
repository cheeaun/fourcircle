var map, isMapLoaded = false;
var $preConnect = document.getElementById('pre-connect');
var $postConnect = document.getElementById('post-connect');
var $login = document.getElementById('login-foursquare');
var $refreshMarkers = document.getElementById('refresh-markers');
var $cleanUp = document.getElementById('clean-up');
var $logout = document.getElementById('logout-foursquare');
var $currentLocation = document.getElementById('current-location');
var $beam = document.getElementById('beam');

var FSQ = hello('foursquare');

$login.addEventListener('click', function(){
  FSQ.login();
}, false);

$logout.addEventListener('click', function(){
  FSQ.logout().then(function(){
    location.reload();
  });
}, false);

var currentInfoWindow = {close: function(){}};
var listID;

hello
  .on('auth.login', function(auth){
    $preConnect.hidden = true;
    $postConnect.hidden = false;

    function getList(callback){
      listID = lscache.get('listID');
      if (listID){
        callback();
      } else {
        FSQ.api('users/self/lists', {group: 'yours'}).then(function(data){
          var items = data.response.lists.items;
          var item = items.filter(function(item){return /todo/.test(item.id)})[0];
          if (!item){
            callback();
            return;
          };
          listID = item.id;
          callback();
          lscache.set('listID', listID, 30*24*60); // 30 days
        });
      }
    };

    var venues = [];
    function getVenues(index, callback){
      var allVenues = lscache.get('allVenues');
      if (allVenues && allVenues.length){
        callback(allVenues);
      } else {
        FSQ.api('lists/' + listID, {
          limit: 200,
          offset: index*200
        }).then(function(d){
          var listItems = d.response.list.listItems;
          venues = venues.concat(listItems.items.map(function(item){ return item.venue; }));
          if (listItems.count > venues.length){
            getVenues(++index, callback);
            return;
          }
          callback(venues);
          lscache.set('allVenues', venues, 24*60); // 24 hours
        });
      }
    };

    var placeMarkers = [];

    function drawMarker(venue){
      var addr = venue.location.formattedAddress;
      var linkAddr = '';
      if (addr && addr.length) addr = addr.join(', ');
      var infoWindow = new google.maps.InfoWindow({
        content: '<div class="info-content">'
          + '<a href="http://foursquare.com/v/' + venue.id + '" target="_blank"><strong>' + venue.name + '</strong></a> '
          + venue.categories.map(function(cat){ return '<small>' + cat.name + '</small>'; }).join(' ')
          + '<br>'
          + addr + '<br>'
          + '<a href="foursquare://venues/' + venue.id + '" class="button">'
            + '<svg viewBox="0 0 8 8"><path d="M.19 0c-.11 0-.19.08-.19.19v7.63c0 .11.08.19.19.19h4.63c.11 0 .19-.08.19-.19v-7.63c0-.11-.08-.19-.19-.19h-4.63zm.81 1h3v5h-3v-5zm1.5 5.5c.28 0 .5.22.5.5s-.22.5-.5.5-.5-.22-.5-.5.22-.5.5-.5z"/></svg> '
            + 'Open'
          +'</a> '
          + '<a href="swarm://checkins/add?venueId=' + venue.id + '" class="button">'
            + '<svg viewBox="0 0 8 8"><path d="M3 0c-1.66 0-3 1.34-3 3 0 2 3 5 3 5s3-3 3-5c0-1.66-1.34-3-3-3zm0 1c1.11 0 2 .9 2 2 0 1.11-.89 2-2 2-1.1 0-2-.89-2-2 0-1.1.9-2 2-2z"/></svg> '
            + 'Check in'
          + '</a> '
          + '<a href="https://www.google.com/maps/dir/Current+Location/' + encodeURIComponent(addr) + '" target="_blank" class="button">'
            + '<svg viewBox="0 0 8 8"><path d="M4 0c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4zm0 1c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm2 1l-3 1-1 3 3-1 1-3zm-2 1.5c.28 0 .5.22.5.5s-.22.5-.5.5-.5-.22-.5-.5.22-.5.5-.5z"/></svg> '
            + 'Directions'
          + '</a>'
          + '</div>'
      });

      var marker = new google.maps.Marker({
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: '#FF4848',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeOpacity: 1,
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
      allVenues.forEach(function(venue){
        var position = new google.maps.LatLng(venue.location.lat, venue.location.lng);
        if (bounds.contains(position)){
          boundedVenues.push(venue);
        } else {
          unboundedVenues.push(venue);
        }
      });

      boundedVenues.forEach(drawMarker);
      setTimeout(function(){
        unboundedVenues.forEach(drawMarker);
      }, 2000);
    };

    getList(function(){
      getVenues(0, plotVenues);
    });

    $refreshMarkers.addEventListener('click', function(){
      clearMarkers();
      lscache.remove('allVenues');
      getList(function(){
        getVenues(0, plotVenues);
      });
    }, false);

    $cleanUp.addEventListener('click', function(){
      var checkedVenues = (sessionStorage.getItem('checkedVenues') || '').split(',');
      var allVenues = lscache.get('allVenues')
      allVenues = allVenues.filter(function(v){ return !checkedVenues.includes(v.id) });
      if (!allVenues.length) console.log('No more to clean up!');
      allVenues.slice(0, 100).forEach(function(venue){
        checkedVenues.push(venue.id);
        FSQ.api('venues/' + venue.id).then(function(data){
          var v = data.response.venue;
          var beenHere = !!v.beenHere.count;
          console.log(beenHere ? '✅' : '❌', v.id, v.name);
          if (beenHere){
            FSQ.api('lists/' + listID + '/deleteitem', 'POST', { venueId: v.id }).then(function(){
              console.log('💥', v.id, v.name);
            });
          }
        });
      });
      sessionStorage.setItem('checkedVenues', checkedVenues.join(','));
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
    disableDefaultUI: true,
    clickableIcons: false,
    styles: [{
      stylers: [
        {lightness: -20},
        {saturation: -50},
      ],
    }],
  });
  isMapLoaded = true;

  var transitLayer = new google.maps.TransitLayer();
  transitLayer.setMap(map);

  var geoMarker = new google.maps.Marker({
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 6,
      fillColor: '#248CFF',
      fillOpacity: 1,
      strokeColor: '#fff',
      strokeOpacity: 1,
      strokeWeight: 3,
    },
    clickable: false,
    map: map,
    title: 'Your current location'
  });

  google.maps.event.addListener(map, 'click', function() {
    currentInfoWindow.close();
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
