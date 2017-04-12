"use strict";
module.exports = {
    up: function(queryInterface, Sequelize) {
        return queryInterface.changeColumn(
            'accounts',
            'password',
            {
               type: Sequelize.STRING(60),
               allowNull: true
            }
        )
        .then(function(){
            return queryInterface.addColumn(
            'accounts',
            'providerData',
            {
              type: Sequelize.TEXT,
              defaultValue: '{"providerId": "cloudpass"}',
              allowNull: false
            }
          );
        });
    },

    down: function(queryInterface) {
        return queryInterface.removeColumn('accounts', 'providerData');
    }

};

