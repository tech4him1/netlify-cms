import ReactDNDHTML5Backend from 'react-dnd-html5-backend';
import { DragDropContext as ReactDNDDragDropContext, DragSource as ReactDNDDragSource, DropTarget as ReactDNDDropTarget } from 'react-dnd';
import React from 'react';
import PropTypes from 'prop-types';

// This is a namespace so that we can only drop these elements on a DropTarget with the same 
const DNDNamespace = 'cms-unpublished-entries';

export const DragSource = ReactDNDDragSource(
  DNDNamespace,
  {
    beginDrag({ children, isDragging, connectDragComponent, ...props }) {
      // We return the rest of the props as the ID of the element being dragged.
      return props;
    },
  },
  (connect, monitor) => ({
    connectDragComponent: connect.dragSource(),
  }),
)(({ children, connectDragComponent }) => connectDragComponent(React.Children.only(children)));

export const DropTarget = ({ onDrop, children: ownChildren, ...ownProps }) => {
  const DropComponent = ReactDNDDropTarget(
    DNDNamespace,
    {
      drop(ownProps, monitor) {
        onDrop(monitor.getItem());
      },
    },
    (connect, monitor) => ({
      connectDropTarget: connect.dropTarget(),
      isHovered: monitor.isOver(),
    }),
  )(({ children, connectDropTarget, isHovered }) => connectDropTarget(children(isHovered)));

  return React.createElement(DropComponent, ownProps, ownChildren);
};
DropTarget.propTypes = {
  onDrop: PropTypes.func.isRequired,
  children: PropTypes.func.isRequired,
};

export const HTML5DragDrop = component => ReactDNDDragDropContext(ReactDNDHTML5Backend)(component);
