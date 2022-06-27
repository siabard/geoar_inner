import React, {Component, useEffect, useState} from 'react';
import {StyleSheet, Platform, ToastAndroid} from 'react-native';
import {
  ViroImage,
  ViroNode,
  ViroARScene,
  ViroText,
  ViroTrackingStateConstants,
  ViroARSceneNavigator,
  ViroFlexView,
} from '@viro-community/react-viro';
import Geolocation from '@react-native-community/geolocation';
import CompassHeading from 'react-native-compass-heading';
import {requestMultiple, PERMISSIONS, RESULTS} from 'react-native-permissions';

const Toast = message => {
  ToastAndroid.showWithGravityAndOffset(
    message,
    ToastAndroid.LONG,
    ToastAndroid.BOTTOM,
    25,
    50,
  );
};

const distanceBetweenPoints = (p1, p2) => {
  if (!p1 || !p2) {
    return 0;
  }

  var R = 6371; // Radius of the Earth in km
  var dLat = ((p2.latitude - p1.latitude) * Math.PI) / 180;
  var dLon = ((p2.longitude - p1.longitude) * Math.PI) / 180;
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.latitude * Math.PI) / 180) *
      Math.cos((p2.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  var d = R * c;
  return d;
};

const HelloWorldSceneAR = () => {
  const [cameraReady, setCameraReady] = useState(false);
  const [locationReady, setLocationReady] = useState(false);
  const [location, setLocation] = useState(undefined);
  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const [tracking, setTracking] = useState(false);
  const [compassHeading, setCompassHeading] = useState(0);
  const [listener, setListener] = useState(undefined);

  const latLongToMerc = (latDeg, longDeg) => {
    const longRad = (longDeg / 180.0) * Math.PI;
    const latRad = (latDeg / 180.0) * Math.PI;
    const smA = 6378137.0;
    const xmeters = smA * longRad;
    const ymeters = smA * Math.log((Math.sin(latRad) + 1) / Math.cos(latRad));
    return {x: xmeters, y: ymeters};
  };

  const transformGpsToAR = (lat, lng) => {

    const isAndroid = Platform.OS === 'android';
    const latObj = lat;
    const longObj = lng;
    const latMobile = location.latitude;
    const longMobile = location.longitude;

    const deviceObjPoint = latLongToMerc(latObj, longObj);
    const mobilePoint = latLongToMerc(latMobile, longMobile);

    const objDeltaY = deviceObjPoint.y - mobilePoint.y;
    const objDeltaX = deviceObjPoint.x - mobilePoint.x;

    if (isAndroid) {
      let degree = compassHeading.heading;
      let angleRadian = (degree * Math.PI) / 180;
      let newObjX =
        objDeltaX * Math.cos(angleRadian) - objDeltaY * Math.sin(angleRadian);
      let newObjY =
        objDeltaX * Math.sin(angleRadian) + objDeltaY * Math.cos(angleRadian);

      return {x: newObjX, z: -newObjY};
    }

    return {x: objDeltaX, z: -objDeltaY};
  };

  const getNearbyPlaces = () => {
    const places = [
      {
        id: 1,
        title: '강남빌딩',
        lat: 37.49673,
        lng: 127.024692,
        icon: 'https://upload.wikimedia.org/wikipedia/commons/8/88/Map_marker.svg',
      },
    ];

    setNearbyPlaces(places);
  };

  const placeARObjects = () => {
    if (nearbyPlaces.length == 0) {
      return undefined;
    }

    const ARTags = nearbyPlaces.map(item => {
      const coords = transformGpsToAR(item.lat, item.lng);
      const scale = Math.abs(Math.round(coords.z / 15));
      const distance = distanceBetweenPoints(location, {
        latitude: item.lat,
        longitude: item.lng,
      });

      return (
        <ViroNode
          key={item.id}
          scale={[scale, scale, scale]}
          rotation={[0, 0, 0]}
          position={[coords.x , 0, coords.z]}>
          <ViroFlexView
            style={{alignItems: 'center', justifyContent: 'center'}}>
            <ViroText
              width={4}
              height={0.5}
              text={item.title}
              style={styles.helloWorldTextStyle}
            />
            <ViroText
              width={4}
              height={0.5}
              text={`${Number(distance).toFixed(2)} km`}
              style={styles.helloWorldTextStyle}
              position={[0, -0.75, 0]}
            />
            <ViroImage
              width={1}
              height={1}
              source={{uri: item.icon}}
              position={[0, -1.5, 0]}
            />
          </ViroFlexView>
        </ViroNode>
      );
    });

    return ARTags;
  };

  const onInitialized = (state, reason) => {
    const tracking =
      state == ViroTrackingStateConstants.TRACKING_NORMAL ||
      state == ViroTrackingStateConstants.TRACKING_LIMITED;
    setTracking(tracking);
    if (tracking) {
      Toast('All set!');
    }
  };

  useEffect(() => {
    const permissions = Platform.select({
      ios: [PERMISSIONS.IOS.CAMERA, PERMISSIONS.IOS.LOCATION_WHEN_IN_USE],
      android: [
        PERMISSIONS.ANDROID.CAMERA,
        PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
      ],
    });

    requestMultiple(permissions).then(statuses => {
      if (Platform.OS == 'ios') {
        setLocationReady(
          statuses[PERMISSIONS.IOS.LOCATION_WHEN_IN_USE] === RESULTS.GRANTED,
        );
        setCameraReady(statuses[PERMISSIONS.IOS.CAMERA] === RESULTS.GRANTED);
      } else {
        setLocationReady(
          statuses[PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION] ===
            RESULTS.GRANTED,
        );
        setCameraReady(
          statuses[PERMISSIONS.ANDROID.CAMERA] === RESULTS.GRANTED,
        );
      }
    });

    CompassHeading.start(3, heading => {
      setCompassHeading(heading);
    });

    return () => {
      if (listener) {
        Geolocation.clearWatch(listener);
      }
      CompassHeading.stop();
    };
  }, []);

  useEffect(() => {
    if (cameraReady && locationReady) {
      const geoSuccess = result => {
        setLocation(result.coords);
        getNearbyPlaces();
      };

      if (!listener) {
        setListener(
          Geolocation.watchPosition(geoSuccess, error => {}, {
            distanceFilter: 10,
          }),
        );
      }
    }
  }, [cameraReady, locationReady]);

  return (
    <ViroARScene onTrackingUpdated={onInitialized}>
      {locationReady && cameraReady && placeARObjects()}
    </ViroARScene>
  );
};

const styles = StyleSheet.create({
  helloWorldTextStyle: {
    fontFamily: 'Arial',
    fontSize: 30,
    color: '#ffffff',
    textAlignVertical: 'center',
    textAlign: 'center',
  },
});

const App = () => {
  return (
    <ViroARSceneNavigator
      worldAlignment={'GravityAndHeading'}
      autofocus={true}
      initialScene={{
        scene: HelloWorldSceneAR,
      }}
      style={{flex: 1}}
    />
  );
};

export default App;
