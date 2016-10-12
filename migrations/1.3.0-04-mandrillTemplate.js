"use strict";
module.exports = {
    up: function(queryInterface, Sequelize) {
        return queryInterface.addColumn(
            'emailTemplates',
            'mandrillTemplate',
            {
              type: Sequelize.STRING,
              allowNull: true
            }
          );
    },
    
    down: function(queryInterface) {
        return queryInterface.removeColumn('emailTemplates', 'mandrillTemplate');
    }
    
};

