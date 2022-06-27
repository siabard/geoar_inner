import React, {Component} from 'react';
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

class HelloWorldSceneAR extends Component {
  constructor(props) {
    super(props);
    this.state = {
      cameraReady: false,
      locationReady: false,
      location: undefined,
      nearbyPlaces: [],
      tracking: false,
      compassHeading: 0,
    };
    this._onInitialized = this._onInitialized.bind(this);
    this.getCurrentLocation = this.getCurrentLocation.bind(this);
    this.transformGpsToAR = this.transformGpsToAR.bind(this);
    this.latLongToMerc = this.latLongToMerc.bind(this);
    this.placeARObjects = this.placeARObjects.bind(this);
    this.getNearbyPlaces = this.getNearbyPlaces.bind(this);
    this.listener = undefined;
  }

  componentDidMount() {
    const permissions = Platform.select({
      ios: [PERMISSIONS.IOS.CAMERA, PERMISSIONS.IOS.LOCATION_WHEN_IN_USE],
      android: [
        PERMISSIONS.ANDROID.CAMERA,
        PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
      ],
    });

    requestMultiple(permissions).then(statuses => {
      if (Platform.OS == 'ios') {
        this.setState(
          {
            locationReady:
              statuses[PERMISSIONS.IOS.LOCATION_WHEN_IN_USE] ===
              RESULTS.GRANTED,
            cameraReady: statuses[PERMISSIONS.IOS.CAMERA] === RESULTS.GRANTED,
          },
          this.getCurrentLocation,
        );
      } else {
        this.setState(
          {
            locationReady:
              statuses[PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION] ===
              RESULTS.GRANTED,
            cameraReady:
              statuses[PERMISSIONS.ANDROID.CAMERA] === RESULTS.GRANTED,
          },
          this.getCurrentLocation,
        );
      }
    });

    CompassHeading.start(3, heading => {
      this.setState({compassHeading: heading});
    });
  }

  componentWillUnmount() {
    if (this.listener) {
      Geolocation.clearWatch(this.listener);
    }
    CompassHeading.stop();
  }

  getCurrentLocation = () => {
    if (this.state.cameraReady && this.state.locationReady) {
      const geoSuccess = result => {
        this.setState(
          {
            location: result.coords,
          },
          this.getNearbyPlaces,
        );
      };

      this.listener = Geolocation.watchPosition(geoSuccess, error => {}, {
        distanceFilter: 10,
      });
    }
  };

  latLongToMerc = (latDeg, longDeg) => {
    // From: https://gist.github.com/scaraveos/5409402
    const longRad = (longDeg / 180.0) * Math.PI;
    const latRad = (latDeg / 180.0) * Math.PI;
    const smA = 6378137.0;
    const xmeters = smA * longRad;
    const ymeters = smA * Math.log((Math.sin(latRad) + 1) / Math.cos(latRad));
    return {x: xmeters, y: ymeters};
  };

  transformGpsToAR = (lat, lng) => {
    const isAndroid = Platform.OS === 'android';
    const latObj = lat;
    const longObj = lng;
    const latMobile = this.state.location.latitude;
    const longMobile = this.state.location.longitude;

    const deviceObjPoint = this.latLongToMerc(latObj, longObj);
    const mobilePoint = this.latLongToMerc(latMobile, longMobile);

    const objDeltaY = deviceObjPoint.y - mobilePoint.y;
    const objDeltaX = deviceObjPoint.x - mobilePoint.x;

    if (isAndroid) {
      let degree = this.state.compassHeading;
      let angleRadian = (degree.heading * Math.PI) / 180;
      let newObjX =
        objDeltaX * Math.cos(angleRadian) - objDeltaY * Math.sin(angleRadian);
      let newObjY =
        objDeltaX * Math.sin(angleRadian) + objDeltaY * Math.cos(angleRadian);

      return {x: newObjX, z: -newObjY};
    }

    return {x: objDeltaX, z: -objDeltaY};
  };

  getNearbyPlaces = () => {
    const places = [
      {
        id: 1,
        title: '강남빌딩',
        lat: 37.49673,
        lng: 127.024692,
        icon: 'https://t1.daumcdn.net/mapjsapi/images/marker.png',
      },
    ];

    this.setState({nearbyPlaces: places});
  };

  placeARObjects = () => {
    if (this.state.nearbyPlaces.length == 0) {
      return undefined;
    }
    const ARTags = this.state.nearbyPlaces.map(item => {
      const coords = this.transformGpsToAR(item.lat, item.lng);
      const scale = Math.abs(Math.round(coords.z / 15));
      const distance = distanceBetweenPoints(this.state.location, {
        latitude: item.lat,
        longitude: item.lng,
      });
      return (
        <ViroNode
          key={item.id}
          scale={[scale, scale, scale]}
          rotation={[0, 0, 0]}
          position={[coords.x, 0, coords.z]}>
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

  render() {
    return (
      <ViroARScene onTrackingUpdated={this._onInitialized}>
        {this.state.locationReady &&
          this.state.cameraReady &&
          this.placeARObjects()}
      </ViroARScene>
    );
  }

  _onInitialized(state, reason) {
    this.setState(
      {
        tracking:
          state == ViroTrackingStateConstants.TRACKING_NORMAL ||
          state == ViroTrackingStateConstants.TRACKING_LIMITED,
      },
      () => {
        if (this.state.tracking) {
          Toast('All set!');
        } else {
          //Toast(`Move your device around gently to calibrate AR (${reason}) and compass.`);
        }
      },
    );
  }
}

var styles = StyleSheet.create({
  helloWorldTextStyle: {
    fontFamily: 'Arial',
    fontSize: 30,
    color: '#ffffff',
    textAlignVertical: 'center',
    textAlign: 'center',
  },
});

export default class App extends React.Component {
  render() {
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
  }
}
