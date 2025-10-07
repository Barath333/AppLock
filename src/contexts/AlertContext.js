import React, {createContext, useContext, useState} from 'react';
import CustomAlert from '../components/CustomAlert';

const AlertContext = createContext();

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};

export const AlertProvider = ({children}) => {
  const [alert, setAlert] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    buttons: [],
  });

  const showAlert = (title, message, type = 'info', buttons = []) => {
    setAlert({
      visible: true,
      title,
      message,
      type,
      buttons:
        buttons.length > 0
          ? buttons
          : [
              {
                text: 'OK',
                onPress: () => {},
              },
            ],
    });
  };

  const hideAlert = () => {
    setAlert(prev => ({...prev, visible: false}));
  };

  return (
    <AlertContext.Provider value={{showAlert}}>
      {children}
      <CustomAlert
        visible={alert.visible}
        title={alert.title}
        message={alert.message}
        type={alert.type}
        buttons={alert.buttons}
        onClose={hideAlert}
      />
    </AlertContext.Provider>
  );
};
