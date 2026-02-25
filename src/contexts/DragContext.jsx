import React from 'react';

export const DragContext = React.createContext();

export const useDragContext = () => React.useContext(DragContext);
