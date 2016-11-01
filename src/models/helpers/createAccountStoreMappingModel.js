"use strict";

var _ = require('lodash');

module.exports = function(mappedModel, mappingModel, accountStoreTypes){
    return function (sequelize, DataTypes) {
        return sequelize.define(
                mappingModel,
                {
                    id: {
                        primaryKey: true,
                        type: DataTypes.UUID,
                        allowNull: false,
                        defaultValue: DataTypes.UUIDV4
                    },
                    accountStoreId: {
                        type: DataTypes.UUID,
                        validate: {isUUID: 4},
                        allowNull: false
                    },
                    accountStoreType: {
                        type: DataTypes.ENUM.apply(this, accountStoreTypes),
                        allowNull: false
                    },
                    listIndex: {
                        type: DataTypes.INTEGER,
                        allowNull: false,
                        defaultValue: 0,
                        validate: {min: 0}
                    },
                    isDefaultAccountStore: {
                        type: DataTypes.BOOLEAN,
                        allowNull: false,
                        defaultValue: false
                    },
                    isDefaultGroupStore: {
                        type: DataTypes.BOOLEAN,
                        allowNull: false,
                        defaultValue: false
                    }
                },
                {
                    indexes: [
                        {
                            unique: true,
                            fields: [mappedModel+'Id', 'accountStoreType', 'accountStoreId' ],
                            //avoid too long index names (max 64 characters for postgres)
                            name: mappingModel.toLowerCase()+'_'+'accountstore'+'_'+mappedModel.toLowerCase()
                        }
                    ],
                    hooks: {
                        afterCreate: afterUpdateOrCreate,
                        afterUpdate: afterUpdateOrCreate,
                        afterDestroy: beforeDestroy
                    },
                    validate: {
                        noGroupNesting: function(){
                            if(this.isDefaultGroupStore && this.accountStoreType === 'group'){
                                throw new Error('Groups cannot store other groups');
                            }
                        }
                    },
                    getterMethods: {
                        accountStore: function() {
                            return this.accountStoreType ?
                                {href: this.sequelize.models[this.accountStoreType].getHref(this.accountStoreId)} :
                                null;
                        }
                    },
                    setterMethods:{
                        accountStore: function(accountStore){
                            this.set('accountStoreId', accountStore.id);
                            this.set('accountStoreType', accountStore.Model.name);
                        }
                    },
                    instanceMethods: {
                        getAccountStore: function(options){
                            var association = this.Model.associations[this.accountStoreType];
                            return this[association.accessors.get](options);
                        }
                    },
                    classMethods: {
                        getSettableAttributes: function(){
                            return ['accountStore', mappedModel, 'listIndex', 'isDefaultAccountStore', 'isDefaultGroupStore'];
                        },
                        associatePriority: function(){
                            //'through' association seem to reset the instance prototypes
                            //the associations of accountStore mappings must be declared last
                            return 1;
                        },
                        mappedModelAssociation: function(){
                            return this.associations[mappedModel];
                        },
                        associate: function(models) {
                            models[mappingModel].belongsTo(models.tenant, {onDelete: 'cascade'});
                            models[mappingModel].belongsTo(models[mappedModel], {onDelete: 'cascade'});

                            accountStoreTypes.forEach(function(accountStoreType){
                                models[mappingModel].belongsTo(
                                    models[accountStoreType],
                                    {
                                        foreignKey: 'accountStoreId',
                                        constraints: false,
                                        scope: {
                                            accountStoreType : accountStoreType
                                        }
                                    }
                                );

                                // set up hooks to destroy account store mappings when the related accounts are destroyed
                                models[accountStoreType].afterDestroy(function(instance){
                                    return models[mappingModel].destroy({
                                        where: {
                                            accountStoreId: instance.id,
                                            accountStoreType : accountStoreType
                                        },
                                        individualHooks: true
                                    });
                                });
                            });
                        }
                    }
                }
        );
    };
};

function afterUpdateOrCreate(mapping){
    var sequelize = this.sequelize;
    var mappedModel = this.mappedModelAssociation().target;
    var mappedModelFk = this.mappedModelAssociation().identifier;
    var promises = [];
    var newDefaultMapping = {};
    var mappingUpdate = {};
    ['Account', 'Group'].forEach(function(storeType){
        var mappingAttribute = 'isDefault'+storeType+'Store';
        var mappedObjectAttribute = 'default'+storeType+'StoreMappingId';

        if(mapping.changed(mappingAttribute)){
            //the default account or group mapping changed
            newDefaultMapping[mappedObjectAttribute] = mapping[mappingAttribute]?mapping.id:null;

            if(mapping[mappingAttribute]){
                //there can be only one default store
                mappingUpdate[mappingAttribute] = false;
            }
        }
    });

    //update the mapped object with its default mappings
    if(!_.isEmpty(newDefaultMapping)){
        promises.push(mappedModel.update(
            newDefaultMapping,
            {where: {id: mapping[mappedModelFk]}}));

        if(!_.isEmpty(mappingUpdate)){
            promises.push(
                this.update(
                  mappingUpdate,
                  {
                    where: {
                      $and: {
                        id: {$ne: mapping.id},
                        [mappedModelFk]: mapping[mappedModelFk]
                      }
                    }
                  }
                )
            );
        }
    }
    return sequelize.Promise.all(promises);
}

function beforeDestroy(mapping){
    //update default account & group mappings
    var sequelize = this.sequelize;
    var mappedModel = this.mappedModelAssociation().target;
    var mappedModelFk = this.mappedModelAssociation().identifier;
    var newDefaultMapping = {};
    ['Account', 'Group'].forEach(function(storeType){
        if(mapping['isDefault'+storeType+'Store']){
            newDefaultMapping['default'+storeType+'StoreMappingId'] = null;
        }
    });
    if(!_.isEmpty(newDefaultMapping)){
        return mappedModel.update(newDefaultMapping, {where: {id: mapping[mappedModelFk]}});
    }
    else {
        return sequelize.Promise.resolve();
    }
}