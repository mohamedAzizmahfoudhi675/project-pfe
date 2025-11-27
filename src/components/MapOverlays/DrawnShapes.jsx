import React from "react";
import { Polyline, Polygon } from "@react-google-maps/api";
import { createCirclePath } from "../../utils/MapView.utils";

export const DrawnShapes = ({ 
  drawnShapes, 
  activeShape, 
  handleShapeClick, 
  getShapeColor 
}) => {
  return (
    <>
      {drawnShapes.polygons.map((shape) => (
        <Polygon
          key={shape.id}
          paths={shape.path}
          options={{
            strokeColor: activeShape === shape.overlay ? SHAPE_COLORS.HIGHLIGHT : getShapeColor(shape.type),
            strokeWeight: activeShape === shape.overlay ? 4 : 2,
            fillColor: SHAPE_COLORS.POLYGON,
            fillOpacity: 0.2,
            clickable: true,
          }}
          onClick={() => handleShapeClick(shape)}
        />
      ))}

      {drawnShapes.polylines.map((shape) => (
        <Polyline
          key={shape.id}
          path={shape.path}
          options={{
            strokeColor: activeShape === shape.overlay ? SHAPE_COLORS.HIGHLIGHT : getShapeColor(shape.type),
            strokeWeight: activeShape === shape.overlay ? 4 : 3,
            clickable: true,
          }}
          onClick={() => handleShapeClick(shape)}
        />
      ))}

      {drawnShapes.circles.map((shape) => (
        <Polygon
          key={shape.id}
          paths={createCirclePath(shape.center, shape.radius)}
          options={{
            strokeColor: activeShape === shape.overlay ? SHAPE_COLORS.HIGHLIGHT : getShapeColor(shape.type),
            strokeWeight: activeShape === shape.overlay ? 4 : 2,
            fillColor: SHAPE_COLORS.CIRCLE,
            fillOpacity: 0.2,
            clickable: true,
          }}
          onClick={() => handleShapeClick(shape)}
        />
      ))}

      {drawnShapes.rectangles.map((shape) => (
        <Polygon
          key={shape.id}
          paths={[
            { lat: shape.bounds.north, lng: shape.bounds.west },
            { lat: shape.bounds.north, lng: shape.bounds.east },
            { lat: shape.bounds.south, lng: shape.bounds.east },
            { lat: shape.bounds.south, lng: shape.bounds.west },
          ]}
          options={{
            strokeColor: activeShape === shape.overlay ? SHAPE_COLORS.HIGHLIGHT : getShapeColor(shape.type),
            strokeWeight: activeShape === shape.overlay ? 4 : 2,
            fillColor: SHAPE_COLORS.RECTANGLE,
            fillOpacity: 0.2,
            clickable: true,
          }}
          onClick={() => handleShapeClick(shape)}
        />
      ))}
    </>
  );
};