import React from 'react';

export const DataContext = React.createContext();

export const useDataContext = () => React.useContext(DataContext);
