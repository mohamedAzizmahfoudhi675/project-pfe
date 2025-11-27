import React from "react";
import { Marker } from "@react-google-maps/api";

export const SearchPlaceMarker = ({ searchPlace }) => {
  if (!searchPlace) return null;

  return (
    <Marker
      position={searchPlace.coordinates}
      icon={{
        url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
      }}
      title={searchPlace.name}
      zIndex={1000}
    />
  );
};